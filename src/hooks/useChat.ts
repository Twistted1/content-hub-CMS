import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

import { CONTENT_SCHEDULE } from '@/utils/scheduling';

// ... other imports ...

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/novee-chat`;

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (userContent: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userContent,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    let assistantContent = '';

    const upsertAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => 
            i === prev.length - 1 ? { ...m, content: assistantContent } : m
          );
        }
        return [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: assistantContent,
          timestamp: new Date(),
        }];
      });
    };

    try {
      const chatHistory = messages.map(m => ({ role: m.role, content: m.content }));
      
      const systemContext = `You are a powerful AI content strategist for Content Hub CMS. 
Your goal is to help the user with multi-platform content creation, strategic scheduling, and campaign management.
Use the provided platform schedules to suggest optimal posting times.
When creating campaigns, ALWAYS output a valid JSON block following the Universal JSON Template (UJT) v1.0 schema:
{
  "version": "1.0",
  "items": [
    {
      "type": "POST",
      "data": { "title": "...", "content": "..." },
      "metadata": { "platforms": ["twitter", "instagram"], "scheduled_at": "YYYY-MM-DDTHH:mm:ssZ" }
    }
  ]
}

Available Platforms: Twitter (3x daily), Instagram (1x daily), Facebook (3x weekly), LinkedIn (3x weekly), Website Articles (3x weekly), TikTok, YouTube, Rumble.
Current Platform Schedules:
${JSON.stringify(CONTENT_SCHEDULE, null, 2)}`;

      let resp;
      let retries = 2;
      
      while (retries >= 0) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) {
            throw new Error('You must be signed in to use the AI assistant.');
          }
          resp = await fetch(CHAT_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              messages: [{ role: 'system', content: systemContext }, ...chatHistory, { role: 'user', content: userContent }],
            }),
          });
          if (resp.ok) break;
        } catch (e) {
          if (retries === 0) throw e;
        }
        retries--;
        await new Promise(res => setTimeout(res, 1000)); // wait 1s before retry
      }

      if (!resp || !resp.ok || !resp.body) {
        const errorData = resp ? await resp.json().catch(() => ({})) : {};
        throw new Error(errorData.error || 'Failed to connect to Novee');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Flush remaining buffer
      if (buffer.trim()) {
        for (const raw of buffer.split('\n')) {
          if (!raw || raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch { /* ignore */ }
        }
      }
    } catch (error) {
      console.error('Novee chat error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to get response from Novee');
      
      // Add fallback response
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "Oops! My circuits got a bit tangled there. 🤖💫 Could you try again?",
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  const resetChat = useCallback(() => {
    setMessages([]);
  }, []);

  const addGreeting = useCallback((greeting: string) => {
    setMessages([{
      id: crypto.randomUUID(),
      role: 'assistant',
      content: greeting,
      timestamp: new Date(),
    }]);
  }, []);

  return { messages, isLoading, sendMessage, resetChat, addGreeting };
}
