import { useState, useEffect } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [dlq, setDlq] = useState([]);
  const [command, setCommand] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [workers, setWorkers] = useState(0);
  const [stats, setStats] = useState({});

  const fetchJobs = async () => {
    try {
      const res = await axios.get(`${API}/list`);
      setJobs(res.data.jobs || res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDLQ = async () => {
    try {
      const res = await axios.get(`${API}/dlq`);
      setDlq(res.data.jobs || res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchWorkers = async () => {
    try {
      const res = await axios.get(`${API}/status`);
      // server returns { stats: { pending: x, completed: y, ... } }
      const s = res.data && res.data.stats ? res.data.stats : {};
      setStats(s);
      // derive total count
      const total = Object.values(s).reduce((a, b) => a + (b || 0), 0);
      setWorkers(0); // backend doesn't track active workers by default
      setStats(prev => ({ ...s, total }));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchJobs();
    fetchDLQ();
    fetchWorkers();
    const interval = setInterval(() => {
      fetchJobs();
      fetchDLQ();
      fetchWorkers();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const enqueueJob = async () => {
    if (!command.trim()) return alert("Enter a command!");
    setLoading(true);
    try {
      const payload = {
        id: `ui-job-${Date.now()}`,
        command,
        max_retries: 3,
      };
      await axios.post(`${API}/enqueue`, payload);
      setCommand("");
      fetchJobs();
    } catch (err) {
      console.error(err);
      alert("Failed to enqueue job: " + (err.response?.data || err.message));
    } finally {
      setLoading(false);
    }
  };

  const retryDLQ = async (id) => {
    try {
      await axios.post(`${API}/dlq/retry/${id}`);
      fetchJobs();
      fetchDLQ();
    } catch (err) {
      console.error(err);
    }
  };

  const startWorker = async () => {
    try {
      await axios.post(`${API}/worker/start`, { count: 1 });
      fetchWorkers();
    } catch (err) {
      console.error(err);
    }
  };

  const stopWorker = async () => {
    try {
      await axios.post(`${API}/worker/stop`);
      fetchWorkers();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredJobs = jobs.filter((j) =>
    filter === "all" ? true : j.state.toLowerCase() === filter
  );

  const getBadgeColor = (state) => {
    switch (state.toLowerCase()) {
      case "pending": return "bg-yellow-500";
      case "processing": return "bg-blue-500";
      case "completed": return "bg-green-600";
      case "failed": return "bg-red-600";
      case "dead": return "bg-red-800";
      default: return "bg-gray-400";
    }
  };

  return (
    <div className="min-h-screen bg-blue-50 font-sans p-6">
      <h1 className="text-4xl font-bold text-blue-950 mb-6 text-center">
        QueueCTL Dashboard
      </h1>

      {/* Counts summary */}
      <div className="max-w-4xl mx-auto mb-6 grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-white rounded shadow p-3 text-center">
          <div className="text-sm text-slate-500">Total</div>
          <div className="text-xl font-bold">{stats.total || 0}</div>
        </div>
        <div className="bg-white rounded shadow p-3 text-center">
          <div className="text-sm text-slate-500">Pending</div>
          <div className="text-xl font-bold">{stats.pending || 0}</div>
        </div>
        <div className="bg-white rounded shadow p-3 text-center">
          <div className="text-sm text-slate-500">Processing</div>
          <div className="text-xl font-bold">{stats.processing || 0}</div>
        </div>
        <div className="bg-white rounded shadow p-3 text-center">
          <div className="text-sm text-slate-500">Completed</div>
          <div className="text-xl font-bold">{stats.completed || 0}</div>
        </div>
        <div className="bg-white rounded shadow p-3 text-center">
          <div className="text-sm text-slate-500">Failed</div>
          <div className="text-xl font-bold">{stats.failed || 0}</div>
        </div>
        <div className="bg-white rounded shadow p-3 text-center">
          <div className="text-sm text-slate-500">Dead</div>
          <div className="text-xl font-bold">{stats.dead || 0}</div>
        </div>
      </div>

      {/* Enqueue */}
      <div className="flex justify-center mb-6 gap-2">
        <input
          className="border border-blue-300 px-4 py-2 rounded w-96 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Enter command e.g., sleep 2"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          disabled={loading}
        />
        <button
          className="bg-blue-950 text-white px-4 py-2 rounded hover:bg-blue-800 transition"
          onClick={enqueueJob}
          disabled={loading}
        >
          {loading ? "Enqueuing..." : "Enqueue"}
        </button>
      </div>

   

      {/* Filter tabs */}
      <div className="flex justify-center gap-4 mb-4 flex-wrap">
        {["all", "pending", "processing", "completed", "failed", "dead"].map(
          (f) => (
            <button
              key={f}
              className={`px-4 py-2 rounded ${
                filter === f
                  ? "bg-blue-950 text-white"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              } transition`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          )
        )}
      </div>

      {/* Jobs */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-blue-950 mb-3 text-center">
          Jobs
        </h2>
        {filteredJobs.length === 0 ? (
          <p className="text-center text-gray-500">No jobs to display.</p>
        ) : (
          <ul className="space-y-2">
            {filteredJobs.map((j) => (
              <li
                key={j.id}
                className="border p-3 rounded flex justify-between items-center hover:shadow-md transition"
              >
                <div>
                  <span className="font-semibold">{j.id}</span>: {j.command}{" "}
                  <span
                    className={`ml-2 px-2 py-1 rounded text-white ${getBadgeColor(
                      j.state
                    )}`}
                  >
                    {j.state}
                  </span>
                  {j.worker && (
                    <span className="ml-2 px-2 py-1 rounded bg-gray-300 text-gray-800">
                      Worker: {j.worker}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Dead Letter Queue */}
      <div>
        <h2 className="text-2xl font-semibold text-red-600 mb-3 text-center">
          Dead Letter Queue
        </h2>
        {dlq.length === 0 ? (
          <p className="text-center text-gray-500">No failed jobs.</p>
        ) : (
          <ul className="space-y-2">
            {dlq.map((j) => (
              <li
                key={j.id}
                className="border p-3 rounded flex justify-between items-center hover:shadow-md transition"
              >
                <div>
                  <span className="font-semibold">{j.id}</span>: {j.command}{" "}
                  <span className="ml-2 px-2 py-1 rounded bg-red-600 text-white">
                    {j.state}
                  </span>
                </div>
                <button
                  className="bg-blue-950 text-white px-3 py-1 rounded hover:bg-blue-800 transition"
                  onClick={() => retryDLQ(j.id)}
                >
                  Retry
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
