import { useState, useEffect } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [dlq, setDlq] = useState([]);
  const [command, setCommand] = useState("");

  const fetchJobs = async () => {
    const res = await axios.get(`${API}/list`);
    setJobs(res.data.jobs || []);
  };

  const fetchDLQ = async () => {
    const res = await axios.get(`${API}/dlq`);
    setDlq(res.data.jobs || []);
  };

  useEffect(() => {
    fetchJobs();
    fetchDLQ();
  }, []);

  const enqueueJob = async () => {
    if (!command) return alert("Enter command");
    await axios.post(`${API}/enqueue`, { command });
    setCommand("");
    fetchJobs();
  };

  const retryDLQ = async (id) => {
    await axios.post(`${API}/dlq/retry/${id}`);
    fetchJobs();
    fetchDLQ();
  };

  return (
    <div className="p-4 font-sans">
      <h1 className="text-3xl font-bold text-blue-950 mb-4">QueueCTL Dashboard</h1>

      <div className="mb-4">
        <input
          className="border px-2 py-1 mr-2 rounded"
          placeholder="Command"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
        />
        <button className="bg-blue-950 text-white px-4 py-1 rounded" onClick={enqueueJob}>
          Enqueue
        </button>
      </div>

      <div className="mb-4">
        <h2 className="text-xl font-semibold text-blue-950 mb-2">Pending / Completed Jobs</h2>
        <ul>
          {jobs.map(j => (
            <li key={j.id} className="border p-2 mb-1 rounded flex justify-between">
              <span>{j.id}: {j.command} ({j.state})</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-red-600 mb-2">Dead Letter Queue</h2>
        <ul>
          {dlq.map(j => (
            <li key={j.id} className="border p-2 mb-1 rounded flex justify-between items-center">
              <span>{j.id}: {j.command} ({j.state})</span>
              <button className="bg-blue-950 text-white px-2 py-1 rounded ml-2" onClick={() => retryDLQ(j.id)}>Retry</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
