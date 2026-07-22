import { useState, useEffect } from "react";

interface JobData {
  id: string;
  state: string;
  progress: number;
  result: any;
}

function App() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobData, setJobData] = useState<JobData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const createJob = async () => {
    setJobData(null);
    setIsLoading(true);
    try {
      const res = await fetch("http://localhost:5000/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoName: "interview-demo.mp4" }),
      });
      const data = await res.json();
      setJobId(data.jobId);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!jobId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/jobs/${jobId}`);
        const data = await res.json();
        setJobData(data);

        if (data.state === "completed" || data.state === "failed") {
          clearInterval(interval);
        }
      } catch (err) {
        console.error(err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [jobId]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 font-sans text-zinc-100">
      <div className="w-full max-w-lg space-y-6 rounded-xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Video Processing Queue
          </h1>
          <p className="text-sm text-zinc-400">
            Click the button to simulate uploading a video and processing it in
            the background using BullMQ and Redis.
          </p>
        </div>

        <button
          onClick={createJob}
          disabled={isLoading}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-900"
        >
          {isLoading ? "Starting..." : "Upload Video & Start Job"}
        </button>

        {jobId && (
          <div className="space-y-4 border-t border-zinc-800 pt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Job ID:</span>
              <span className="rounded bg-zinc-800 px-2 py-1 font-mono text-zinc-300">
                {jobId}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">State:</span>
              <span
                className={`font-semibold uppercase ${
                  jobData?.state === "completed"
                    ? "text-green-400"
                    : jobData?.state === "failed"
                      ? "text-red-400"
                      : "text-blue-400"
                }`}
              >
                {jobData?.state || "Fetching..."}
              </span>
            </div>

            {jobData &&
              jobData.state !== "completed" &&
              jobData.state !== "failed" && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-zinc-400">
                    <span>Progress</span>
                    <span>{Math.round(jobData.progress)}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all duration-500 ease-out"
                      style={{ width: `${jobData.progress}%` }}
                    />
                  </div>
                </div>
              )}

            {jobData?.state === "completed" && (
              <div className="space-y-2 rounded-lg border border-green-800 bg-green-900/20 p-4">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-green-400">
                    ✅ Video Processed Successfully!
                  </span>
                </div>
                <div className="text-xs break-all text-zinc-400">
                  <span className="text-zinc-500">Output URL: </span>
                  <span className="text-zinc-300">
                    {jobData.result.outputUrl}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
