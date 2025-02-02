"use client";

import { useState, useRef } from "react";

export default function Home() {
  const [audioClips, setAudioClips] = useState<
    { url: string; id: number; loop: boolean }[]
  >([]);
  const [isRecording, setIsRecording] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [gainNode, setGainNode] = useState<GainNode | null>(null);
  const [filterNode, setFilterNode] = useState<BiquadFilterNode | null>(null);
  const [pitchShift, setPitchShift] = useState(1);
  const [volume, setVolume] = useState(1);
  const [playingSources, setPlayingSources] = useState<
    Map<number, AudioBufferSourceNode>
  >(new Map());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;

    const audioChunks: Blob[] = [];
    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
      const url = URL.createObjectURL(audioBlob);
      setAudioClips((prev) => [...prev, { url, id: prev.length, loop: false }]);
    };

    mediaRecorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const setupAudioContext = () => {
    const ctx = new AudioContext();
    setAudioContext(ctx);

    const gain = ctx.createGain();
    setGainNode(gain);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1000, ctx.currentTime);
    setFilterNode(filter);
  };

  const playAudioWithEffects = async (
    url: string,
    id: number,
    loop: boolean
  ) => {
    if (!audioContext) return;

    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.playbackRate.setValueAtTime(
      pitchShift,
      audioContext.currentTime
    );
    sourceNode.loop = loop;

    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);

    sourceNode.connect(gainNode).connect(audioContext.destination);
    sourceNode.start();

    setPlayingSources((prev) => {
      const newMap = new Map(prev);
      newMap.set(id, sourceNode);
      return newMap;
    });

    sourceNode.onended = () => {
      setPlayingSources((prev) => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
    };
  };

  const toggleLoop = (id: number) => {
    setAudioClips((prevClips) =>
      prevClips.map((clip) =>
        clip.id === id ? { ...clip, loop: !clip.loop } : clip
      )
    );

    if (playingSources.has(id)) {
      const sourceNode = playingSources.get(id);
      sourceNode?.stop();
      setPlayingSources((prev) => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-screen bg-gray-900 text-white p-4">
      <h1 className="text-2xl font-bold">Jam</h1>
      <div className="mt-4">
        {isRecording ? (
          <button
            className="bg-red-500 px-4 py-2 rounded"
            onClick={stopRecording}
          >
            Stop Recording
          </button>
        ) : (
          <button
            className="bg-green-500 px-4 py-2 rounded"
            onClick={startRecording}
          >
            Start Recording
          </button>
        )}
      </div>
      <button
        className="bg-blue-500 px-4 py-2 rounded mt-4"
        onClick={setupAudioContext}
      >
        Initialize Audio Effects
      </button>
      <div className="grid grid-cols-3 gap-4 mt-4">
        {audioClips.map((clip) => (
          <div key={clip.id} className="flex flex-col items-center">
            <button
              className="bg-purple-500 w-20 h-20 rounded-lg flex items-center justify-center"
              onClick={() => playAudioWithEffects(clip.url, clip.id, clip.loop)}
            >
              {clip.id + 1}
            </button>
            <button
              className="bg-yellow-500 px-2 py-1 rounded mt-2"
              onClick={() => toggleLoop(clip.id)}
            >
              {clip.loop ? "Disable Loop" : "Enable Loop"}
            </button>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <label>Pitch Shift</label>
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.01"
          value={pitchShift}
          onChange={(e) => setPitchShift(parseFloat(e.target.value))}
        />
      </div>
      <div className="mt-4">
        <label>Volume</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
        />
      </div>
    </div>
  );
}
