import axios from "axios";

const API = axios.create({ baseURL: "http://localhost:3000" });

export const enqueueJob = (job) => API.post("/enqueue", job);
export const listJobs = (state) => API.get(`/list?state=${state}`);
export const getStatus = () => API.get("/status");
export const listDLQ = () => API.get("/dlq");
export const retryDLQ = (id) => API.post(`/dlq/retry/${id}`);
export const setConfig = (config) => API.post("/config", config);
