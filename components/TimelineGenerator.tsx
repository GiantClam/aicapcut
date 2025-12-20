"use client"

import React, { useState } from 'react';
import { useRunClipsSSE } from '../lib/useSSEStream';
import { ClipSpec, workflowPlan, workflowConfirm, workflowStitch } from '../lib/saleagent-client';

export default function TimelineGenerator() {
  const { events, results, running, start, stop, clear } = useRunClipsSSE();
  const [storyboards, setStoryboards] = useState<ClipSpec[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [finalUrl, setFinalUrl] = useState<string | null>(null);

  const plan = async () => {
    // Example parameters - in a real app these would come from inputs
    const p = await workflowPlan("主题：轻薄长续航", 10.0, ["科技感"], true);
    setStoryboards(p.storyboards);
  };

  const confirm = async () => {
    // In a real app, user might have modified storyboards
    const c = await workflowConfirm(storyboards, 10.0, ["科技感"], true);
    setRunId(c.run_id);
  };

  const runClips = async () => {
    if (!runId) return;
    await start(runId, storyboards);
  };

  const stitch = async () => {
    if (!runId) return;
    // Collect successful video URLs
    const segments = results
        .filter(r => r.status === "succeeded" && r.video_url)
        .map(r => r.video_url!);
        
    const s = await workflowStitch(runId, segments);
    setFinalUrl(s.final_url);
  };

  return (
    <div className="p-4 space-y-3 bg-white text-black min-h-screen">
      <h1 className="text-xl font-bold">Concurrent Lens Generation (Example)</h1>
      <div className="flex gap-2 flex-wrap">
        <button className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700" onClick={plan}>
            1. 分镜规划
        </button>
        <button className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50" onClick={confirm} disabled={storyboards.length === 0}>
            2. 确认方案
        </button>
        <button className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50" onClick={runClips} disabled={!runId || running}>
            3. 生成镜头 (SSE)
        </button>
        <button className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50" onClick={stitch} disabled={results.filter(r => r.status === 'succeeded').length === 0}>
            4. 拼接视频
        </button>
        <button className="px-3 py-1 bg-gray-200 text-black rounded hover:bg-gray-300" onClick={() => { stop(); clear(); }}>
            清空/停止
        </button>
      </div>

      {/* Storyboards / Results */}
      <div className="space-y-2">
        {storyboards.map(sb => {
          const r = results.find(x => x.idx === (sb.idx || sb.scene_idx));
          return (
            <div key={sb.idx || sb.scene_idx} className="p-2 border rounded bg-gray-50">
              <div className="font-medium">镜头 { (sb.idx || sb.scene_idx) + 1}</div>
              <div className="text-gray-600 text-sm mb-2">{sb.desc || sb.narration}</div>
              
              <div className="text-xs font-mono mb-2">
                  状态：
                  <span className={
                      r?.status === 'succeeded' ? 'text-green-600' :
                      r?.status === 'failed' ? 'text-red-600' :
                      r?.status === 'generating' ? 'text-blue-600' : 'text-gray-500'
                  }>
                      {r?.status || "pending"}
                  </span>
                  {r?.error && <span className="text-red-500 ml-2">({r.error})</span>}
              </div>

              {r?.video_url && (
                <video className="w-full mt-2 max-w-md bg-black" src={r.video_url} controls />
              )}
            </div>
          )
        })}
      </div>

      {/* Final Video */}
      {finalUrl && (
        <div className="p-3 bg-green-50 border border-green-200 rounded mt-4">
          <div className="font-medium text-green-700 mb-2">最终视频</div>
          <video className="w-full mt-2 max-w-lg bg-black" src={finalUrl} controls />
        </div>
      )}
      
      {/* Event Log */}
      <div className="mt-8 border-t pt-4">
          <h3 className="font-bold mb-2">Event Log</h3>
          <div className="bg-gray-100 p-2 rounded h-40 overflow-y-auto text-xs font-mono">
              {events.map((e, i) => (
                  <div key={i} className="mb-1">
                      <span className="text-blue-600">[{e.type}]</span> {JSON.stringify(e.payload || e.delta)}
                  </div>
              ))}
          </div>
      </div>
    </div>
  )
}
