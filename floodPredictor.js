import axios from 'axios';
export async function getFloodPrediction(data) {
  const res = await axios.post(process.env.PYTHON_API_URL, data);
  return res.data;
}
