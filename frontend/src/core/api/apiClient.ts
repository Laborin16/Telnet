import axios from "axios";
import { getStoredToken } from "../../modules/auth/hooks/useAuth";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "",
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

// Inyecta el JWT en cada petición
apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

// Si el servidor devuelve 401 limpia el token y recarga
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      const url = err?.config?.url ?? "";
      // No limpiar en el endpoint de login (evita loop)
      if (!url.includes("/auth/login")) {
        localStorage.removeItem("wisp_token");
        window.location.reload();
      }
    }
    return Promise.reject(err);
  }
);

export default apiClient;
