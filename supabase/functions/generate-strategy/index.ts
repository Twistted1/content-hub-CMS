import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Require an authenticated user — prevents anonymous Gemini quota drain
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token)
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { topic } = await req.json()
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')

    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not set')
    }

    if (!topic || typeof topic !== 'string') {
      return new Response(JSON.stringify({ error: 'Topic is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    // Sanitize: strip control chars, collapse whitespace, enforce length cap
    const sanitizedTopic = topic
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (sanitizedTopic.length === 0 || sanitizedTopic.length > 500) {
      return new Response(JSON.stringify({ error: 'Topic must be 1-500 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const systemInstruction = `You are a Headless CMS Content Strategist. Generate a weekly content strategy (Monday to Sunday) based on the user's topic.
Return ONLY valid JSON matching this exact structure:
{
  "weekStartDate": "YYYY-MM-DD",
  "platforms": ["twitter", "instagram", "facebook", "linkedin", "tiktok", "rumble", "youtube", "website"],
  "content_strategy": [
    {
      "day": "Monday",
      "topic": "Subtopic for Monday",
      "image": "/images/workflow/placeholder.png",
      "article": { "title": "...", "content": "..." },
      "twitter": ["Tweet 1", "Tweet 2", "Tweet 3"],
      "instagram": { "caption": "...", "image": "..." },
      "facebook": { "post": "..." },
      "linkedin": { "post": "..." },
      "tiktok": { "script": "...", "thumbnail": "..." },
      "youtube": { "community_post": "...", "video_title": "...", "thumbnail": "..." },
      "rumble": { "post": "...", "thumbnail": "..." }
    }
  ]
}
Note: the 'content_strategy' array MUST contain exactly 7 objects, one for each day from Monday to Sunday.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: `Generate a 7-day strategy for the topic: ${sanitizedTopic}` }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json"
        }
      }),
    })

    const data = await response.json()
    
    if (data.error) {
      throw new Error(data.error.message)
    }

    // Extract the JSON string from Gemini's response
    let textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textContent) {
      throw new Error('Failed to generate content from Gemini');
    }

    // Strip markdown formatting if Gemini wrapped the response
    textContent = textContent.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');

    const contentStrategy = JSON.parse(textContent);

    return new Response(JSON.stringify(contentStrategy), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
