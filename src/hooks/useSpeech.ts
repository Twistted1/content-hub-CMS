import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Speech-to-text via the browser's SpeechRecognition API (voice "in").
 * Not part of the standard TS DOM lib, and Safari/Firefox don't implement
 * it at all - `supported` is false there and callers should disable the
 * mic button rather than let it silently no-op.
 */
export function useSpeechRecognition(onResult: (finalTranscript: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported] = useState(
    () => typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  );
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef("");
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const start = useCallback(() => {
    if (!supported || listening) return;
    const SpeechRecognitionImpl = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionImpl();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";
    finalTranscriptRef.current = "";

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += event.results[i][0].transcript;
        }
      }
      onResultRef.current(finalTranscriptRef.current);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [supported, listening]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  // Stop any live mic capture on unmount - a recognition session left
  // running after the component is gone keeps the browser's mic indicator
  // lit for no reason.
  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  return { supported, listening, start, stop };
}

/**
 * Text-to-speech via the browser's SpeechSynthesis API (voice "out").
 * `speakingId` tracks which caller-supplied id is currently playing, so a
 * message list can show per-message play/stop state without each message
 * owning its own Utterance.
 */
export function useSpeechSynthesisPlayer() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [supported] = useState(() => typeof window !== "undefined" && "speechSynthesis" in window);

  const speak = useCallback((text: string, id: string) => {
    if (!supported || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setSpeakingId((current) => (current === id ? null : current));
    utterance.onerror = () => setSpeakingId((current) => (current === id ? null : current));
    window.speechSynthesis.speak(utterance);
    setSpeakingId(id);
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, [supported]);

  useEffect(() => {
    if (!supported) return;
    return () => { window.speechSynthesis.cancel(); };
  }, [supported]);

  return { supported, speakingId, speak, stop };
}
