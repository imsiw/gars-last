import axios from "axios";

export async function searchRoutes(from, to) {
  const res = await axios.get("http://localhost:8000/api/routes", {
    params: { frm: from, to }
  });
  return res.data;
}
