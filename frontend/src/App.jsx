import { useState, useEffect } from "react";
import { enqueueJob, listJobs, getStatus, listDLQ, retryDLQ } from "./api";
import { FaRedo } from "react-icons/fa";
import "./index.css";

function App() {
  const [jobId, setJobId] = useState("");
  const [command, setCommand] = useState("");
  const [maxRetries, setMaxRetries] = useState(3);
  const [message, setMessage] = useState("");
  const [jobs, setJobs] = useState([]);
  const [dlqJobs, setDlqJobs] = useState([]);
  const [status, setStatus] = useState({});
  const [filterState, setFilterState] = useState("pending");

  const fetchJobs = async () => {
    try {
      const res = await listJobs(filterState);
      setJobs(res.data.jobs);
    } catch {}
  };

  const fetchDLQ = async () => {
    try {
      const res = await listDLQ();
      setDlqJobs(res.data.jobs);
    } catch {}
  };

  const fetchStatus = async () => {
    try {
      const res = await getStatus();
      setStatus(res.data.stats || {});
    } catch {}
  };

  useEffect(() => {
    fetchJobs();
    fetchDLQ();
    fetchStatus();
    const interval = setInterval(() => {
      fetchJobs();
      fetchDLQ();
      fetchStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [filterState]);

  const handleEnqueue = async () => {
    try {
      await enqueueJob({ id: jobId || undefined, command, max_retries: maxRetries });
      setMessage("Job enqueued successfully!");
      setJobId(""); setCommand(""); setMaxRetries(3);
      fetchJobs();
    } catch (err) {
      setMessage(err.response?.data?.error || err.message);
    }
  };

  const handleRetryDLQ = async (id) => {
    try {
      await retryDLQ(id);
      fetchDLQ();
      fetchJobs();
    } catch {}
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold mb-6 text-center text-blue-600">QueueCTL Dashboard</h1>

      {/* Enqueue Job */}
      <div className="bg-white p-4 rounded shadow mb-6">
        <h2 className="text-xl font-semibold mb-2">Enqueue Job</h2>
        <div className="flex gap-2 flex-wrap">
          <input value={jobId} onChange={e => setJobId(e.target.value)} placeholder="Job ID (optional)" className="border p-2 rounded flex-1" />
          <input value={command} onChange={e => setCommand(e.target.value)} placeholder="Command" className="border p-2 rounded flex-1" />
          <input type="number" value={maxRetries} onChange={e => setMaxRetries(Number(e.target.value))} placeholder="Max retries" className="border p-2 rounded w-32" />
          <button onClick={handleEnqueue} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Enqueue</button>
        </div>
        {message && <p className="text-green-600 mt-2">{message}</p>}
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Object.entries(status).map(([key, val]) => (
          <div key={key} className="bg-white p-4 rounded shadow text-center">
            <div className="text-gray-500">{key.charAt(0).toUpperCase() + key.slice(1)}</div>
            <div className="text-2xl font-bold">{val}</div>
          </div>
        ))}
      </div>

      {/* Jobs Table */}
      <div className="bg-white p-4 rounded shadow mb-6">
        <h2 className="text-xl font-semibold mb-2">Jobs</h2>
        <select value={filterState} onChange={e => setFilterState(e.target.value)} className="border p-2 rounded mb-2">
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="dead">Dead</option>
        </select>
        <div className="overflow-x-auto">
          <table className="w-full border">
            <thead className="bg-gray-200">
              <tr>
                <th className="p-2 border">ID</th>
                <th className="p-2 border">Command</th>
                <th className="p-2 border">State</th>
                <th className="p-2 border">Attempts</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="p-2 border">{job.id}</td>
                  <td className="p-2 border">{job.command}</td>
                  <td className="p-2 border">{job.state}</td>
                  <td className="p-2 border">{job.attempts}/{job.max_retries}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DLQ Table */}
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-2 text-red-600">Dead Letter Queue</h2>
        <div className="overflow-x-auto">
          <table className="w-full border">
            <thead className="bg-red-100">
              <tr>
                <th className="p-2 border">ID</th>
                <th className="p-2 border">Command</th>
                <th className="p-2 border">Last Error</th>
                <th className="p-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {dlqJobs.map(job => (
                <tr key={job.id} className="hover:bg-red-50">
                  <td className="p-2 border">{job.id}</td>
                  <td className="p-2 border">{job.command}</td>
                  <td className="p-2 border">{job.last_error}</td>
                  <td className="p-2 border">
                    <button onClick={() => handleRetryDLQ(job.id)} className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 flex items-center gap-1">
                      <FaRedo /> Retry
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;
