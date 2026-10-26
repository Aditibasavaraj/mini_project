import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { onValue, ref } from "firebase/database";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { auth, database } from "./firebase";
import "./App.css";

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reading, setReading] = useState(null);
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [message, setMessage] = useState("");
  const [loadingData, setLoadingData] = useState(false);

  const ripenessData = [
    { name: "Unripe", count: history.filter((item) => item.prediction === "Unripe").length, color: "#f59e0b" },
    { name: "Ripe", count: history.filter((item) => item.prediction === "Ripe").length, color: "#16a34a" },
    { name: "Rotten", count: history.filter((item) => item.prediction === "Rotten").length, color: "#dc2626" }
  ];

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setCheckingAuth(false);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setReading(null);
      setLoadingData(false);
      return;
    }
    setLoadingData(true);
    const unsubscribe = onValue(
      ref(database, "current_reading"),
      (snapshot) => {
        setReading(snapshot.val());
        setLoadingData(false);
        setMessage("");
      },
      (error) => {
        setLoadingData(false);
        setMessage(`Database error: ${error.message}`);
      }
    );
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }
    const unsubscribeHistory = onValue(
      ref(database, "history"),
      (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          setHistory([]);
          return;
        }
        const records = Object.entries(data)
          .filter(([, item]) =>
            item && item.mq4 != null && item.mq135 != null &&
            item.prediction_type === "ripeness"
          )
          .map(([id, item]) => ({
            id, ...item, mq4: Number(item.mq4), mq135: Number(item.mq135)
          }))
          .filter((item) => Number.isFinite(item.mq4) && Number.isFinite(item.mq135))
          .sort((a, b) => (a.timestamp ?? "").localeCompare(b.timestamp ?? ""));
        setHistory(records);
      },
      (error) => {
        console.error("History error:", error.message);
        setHistory([]);
      }
    );
    return () => unsubscribeHistory();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setAlerts([]);
      return;
    }
    const unsubscribeAlerts = onValue(
      ref(database, "alerts"),
      (snapshot) => {
        const data = snapshot.val();
        const records = data
          ? Object.entries(data)
              .filter(([, alert]) => alert && typeof alert === "object")
              .map(([id, alert]) => ({ id, ...alert }))
              .sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""))
          : [];
        setAlerts(records);
      },
      (error) => {
        console.error("Alerts error:", error.message);
        setMessage(`Alerts error: ${error.message}`);
        setAlerts([]);
      }
    );
    return () => unsubscribeAlerts();
  }, [user]);

  async function handleLogin(event) {
    event.preventDefault();
    setMessage("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setPassword("");
    } catch (error) {
      setMessage(`Login failed: ${error.code}`);
    }
  }

  async function handleLogout() {
    try {
      await signOut(auth);
      setMessage("");
    } catch (error) {
      setMessage(`Logout failed: ${error.message}`);
    }
  }

  if (checkingAuth) return <main className="page">Checking login...</main>;

  if (!user) {
    return (
      <main className="page">
        <section className="panel login">
          <div className="logo">🍎</div>
          <h1>FruitGuard</h1>
          <p>Smart Fruit Quality Monitoring</p>
          <form onSubmit={handleLogin}>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="submit">Login</button>
          </form>
          {message && <p className="error">{message}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="dashboard">
        <header>
          <div>
            <h1>🍎 FruitGuard</h1>
            <p>Smart Fruit Monitoring Dashboard</p>
          </div>
          <button className="logout" onClick={handleLogout}>Logout</button>
        </header>

        <div className="status">
          <span>☁️ Firebase Connected</span>
          <span>Fruit: {reading?.fruit ?? "—"}</span>
        </div>

        {loadingData && <p>Loading sensor data...</p>}
        {message && <p className="error">{message}</p>}

        {reading && (
          <>
            <div className="cards">
              <article className="sensor-card">
                <span>🌡️ Temperature</span>
                <strong>{reading.temperature != null ? `${reading.temperature} °C` : "—"}</strong>
              </article>
              <article className="sensor-card">
                <span>💧 Humidity</span>
                <strong>{reading.humidity != null ? `${reading.humidity} %` : "—"}</strong>
              </article>
              <article className="sensor-card">
                <span>🧪 MQ-4</span>
                <strong>{reading.mq4 ?? "—"}</strong>
              </article>
              <article className="sensor-card">
                <span>🧪 MQ-135</span>
                <strong>{reading.mq135 ?? "—"}</strong>
              </article>
            </div>

            <div className="prediction">
              <h2>🍌 Banana Ripeness Prediction</h2>
              <p>🍌 Predicted Ripeness: <strong>{reading.prediction_type === "ripeness" ? reading.prediction ?? "Not available" : "Not available"}</strong></p>
              <p>🎯 Model Confidence: {reading.prediction_type === "ripeness" && reading.confidence != null ? `${reading.confidence}%` : "—"}</p>
              <small>Data source: {reading.source ?? "Unknown"}</small>
              {reading.prediction_type === "ripeness" && reading.confidence != null && Number(reading.confidence) < 70 && (
                <p style={{ color: "#b45309", fontWeight: "bold", marginTop: "10px" }}>
                  ⚠️ Low model confidence — prediction uncertain
                </p>
              )}
              {reading.source === "dataset_ml_simulation" && (
                <p><small>Dataset simulation — not live hardware</small></p>
              )}
            </div>
          </>
        )}

        {!loadingData && !reading && !message && <p>No sensor readings found.</p>}

        <div className="history-chart">
          <h2>📈 Sensor History</h2>
          <p>MQ-4 and MQ-135 dataset simulation readings</p>
          {history.length === 0 ? <p>No MQ-4 / MQ-135 history records yet.</p> : (
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history.map((item, index) => ({ ...item, readingNumber: index + 1 }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="readingNumber" label={{ value: "Reading Number", position: "insideBottom", offset: -5 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend verticalAlign="top" />
                  <Line type="monotone" dataKey="mq4" name="MQ-4" stroke="#16a34a" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="mq135" name="MQ-135" stroke="#2563eb" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="history-chart">
          <h2>🍌 Ripeness Prediction History</h2>
          <p>Recent predictions from the dataset simulation</p>
          {history.length === 0 ? <p>No ripeness predictions available yet.</p> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", marginTop: "15px" }}>
                <thead>
                  <tr>
                    <th style={{ padding: 10 }}>#</th>
                    <th style={{ padding: 10 }}>MQ-4</th>
                    <th style={{ padding: 10 }}>MQ-135</th>
                    <th style={{ padding: 10 }}>Ripeness</th>
                    <th style={{ padding: 10 }}>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice().reverse().slice(0, 10).map((item, index) => (
                    <tr key={item.id} style={{ borderTop: "1px solid #d1d5db" }}>
                      <td style={{ padding: 10 }}>{index + 1}</td>
                      <td style={{ padding: 10 }}>{item.mq4.toFixed(3)}</td>
                      <td style={{ padding: 10 }}>{item.mq135.toFixed(3)}</td>
                      <td style={{ padding: 10 }}>
                        <strong style={{ color: item.prediction === "Ripe" ? "#15803d" : item.prediction === "Rotten" ? "#dc2626" : "#b45309" }}>
                          {item.prediction ?? "Unknown"}
                        </strong>
                      </td>
                      <td style={{ padding: 10 }}>
                        {item.confidence != null && Number.isFinite(Number(item.confidence)) ? `${Number(item.confidence).toFixed(2)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="history-chart">
          <h2>🍌 Ripeness Distribution</h2>
          <p>Distribution of simulated predictions in Firebase history</p>
          {history.length === 0 ? <p>No predictions available yet.</p> : (
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={ripenessData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={95} label={({ name, value }) => `${name}: ${value}`}>
                    {ripenessData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="history-chart">
          <h2>📱 Farmer SMS Alerts</h2>
          <p>Firebase cloud alert records — demo alerts are not actual SMS messages.</p>
          {alerts.length === 0 ? <p>No farmer alerts recorded yet.</p> : (
            <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
              {alerts.slice(0, 10).map((alert) => (
                <article key={alert.id} style={{ border: "1px solid #d1d5db", borderLeft: `5px solid ${alert.prediction === "Rotten" ? "#dc2626" : alert.prediction === "Ripe" ? "#16a34a" : "#f59e0b"}`, borderRadius: 10, padding: 14, textAlign: "left" }}>
                  <strong>{alert.prediction === "Rotten" ? "🚨" : "🍌"} {alert.prediction ?? "Ripeness"} Alert</strong>
                  <p style={{ margin: "8px 0" }}>{alert.message ?? "No message provided."}</p>
                  <small>Batch: {alert.batch_id ?? "—"} | Confidence: {alert.confidence != null ? `${alert.confidence}%` : "—"}</small>
                  <p style={{ margin: "8px 0 4px" }}>
                    <small>Status: {alert.sms_sent === true ? "Marked sent" : "Not sent as SMS"} | Mode: {alert.delivery_mode ?? "Unknown"}</small>
                  </p>
                  <small>{alert.timestamp ? new Date(alert.timestamp).toLocaleString() : "Time unavailable"}</small>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
