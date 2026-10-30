
import { useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { onValue, ref } from "firebase/database";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import { auth, database } from "./firebase";
import "./App.css";

function numberValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function flattenDatasets(data) {
  if (!data || typeof data !== "object") {
    return [];
  }

  const records = [];

  Object.entries(data).forEach(([fruitName, fruitData]) => {
    const fruitRecords = fruitData?.records;

    if (!fruitRecords || typeof fruitRecords !== "object") {
      return;
    }

    Object.entries(fruitRecords).forEach(([recordId, record]) => {
      if (!record || typeof record !== "object") {
        return;
      }

      records.push({
        ...record,
        fruit_type: record.fruit_type || fruitName,
        record_id: recordId,
      });
    });
  });

  return records;
}

function SensorCard({
  name,
  icon,
  description,
  value,
  unit = "",
}) {
  return (
    <section className="sensor-card">
      <div className="sensor-heading">
        <div className="sensor-icon">{icon}</div>

        <div>
          <p className="sensor-description">{description}</p>
          <h3>{name}</h3>
        </div>
      </div>

      <div className="single-reading">
        <span>Latest reading</span>

        <strong className={value === null ? "empty-value" : ""}>
          {value === null
            ? "— —"
            : `${Number(value).toFixed(3)}${unit}`}
        </strong>
      </div>
    </section>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err.message || "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleLogin}>
        <div className="login-logo">F</div>

        <p className="eyebrow">FRUITGUARD</p>
        <h1>Welcome back</h1>
        <p className="login-subtitle">
          Sign in to access your sensor dashboard.
        </p>

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Enter your email"
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter your password"
          required
        />

        {error && <p className="login-error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}

function Dashboard({ user }) {
  const [records, setRecords] = useState([]);
  const [currentReading, setCurrentReading] = useState(null);
  const [datasetLoading, setDatasetLoading] = useState(true);
  const [datasetError, setDatasetError] = useState("");
  const [readingError, setReadingError] = useState("");

  useEffect(() => {
    const datasetsRef = ref(database, "datasets");

    const unsubscribe = onValue(
      datasetsRef,
      (snapshot) => {
        const data = snapshot.val();

        setRecords(flattenDatasets(data));
        setDatasetError("");
        setDatasetLoading(false);
      },
      (error) => {
        setDatasetError(error.message);
        setDatasetLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const readingRef = ref(database, "current_reading");

    const unsubscribe = onValue(
      readingRef,
      (snapshot) => {
        setCurrentReading(snapshot.val());
        setReadingError("");
      },
      (error) => {
        setReadingError(error.message);
      }
    );

    return () => unsubscribe();
  }, []);

  // Latest available MQ4 and MQ135 values from the imported dataset.
  const mq4Dataset = useMemo(() => {
    for (let i = records.length - 1; i >= 0; i--) {
      const value = numberValue(records[i].mq4);
      if (value !== null) return value;
    }

    return null;
  }, [records]);

  const mq135Dataset = useMemo(() => {
    for (let i = records.length - 1; i >= 0; i--) {
      const value = numberValue(records[i].mq135);
      if (value !== null) return value;
    }

    return null;
  }, [records]);

  // Temperature and humidity come from the live Firebase node.
  const temperatureLive = numberValue(
    currentReading?.temperature
  );

  const humidityLive = numberValue(
    currentReading?.humidity
  );

  // Keep only the latest 100 available dataset samples.
  const graphData = useMemo(() => {
    return records
      .map((record, index) => ({
        sample: index + 1,
        MQ4: numberValue(record.mq4),
        MQ135: numberValue(record.mq135),
      }))
      .filter(
        (item) => item.MQ4 !== null || item.MQ135 !== null
      )
      .slice(-100);
  }, [records]);

  return (
    <main className="dashboard">
      <header className="top-header">
        <div className="brand">
          <div className="brand-logo">F</div>

          <div>
            <h1>FruitGuard</h1>
            <p>Sensor monitoring dashboard</p>
          </div>
        </div>

        <button
          className="logout-button"
          onClick={() => signOut(auth)}
        >
          Sign out
        </button>
      </header>

      <section className="welcome-section">
        <div>
          <p className="eyebrow">DASHBOARD</p>
          <h2>Welcome back</h2>
          <p>
            Monitor your fruit storage sensor readings.
          </p>
        </div>

        <div className="user-info">
          <span className="status-dot" />
          {user.email}
        </div>
      </section>

      <section className="section-title">
        <div>
          <p className="eyebrow">SENSOR MONITORING</p>
          <h2>Sensor readings</h2>
        </div>
      </section>

      <section className="sensor-grid">
        <SensorCard
          name="MQ4"
          icon="◉"
          description="Gas sensor"
          value={mq4Dataset}
        />

        <SensorCard
          name="MQ135"
          icon="◉"
          description="Air quality / gas sensor"
          value={mq135Dataset}
        />

        <SensorCard
          name="Temperature"
          icon="°"
          description="Environmental sensor"
          value={temperatureLive}
          unit=" °C"
        />

        <SensorCard
          name="Humidity"
          icon="%"
          description="Environmental sensor"
          value={humidityLive}
          unit=" %"
        />
      </section>

      {readingError && (
        <p className="message error-message">
          Unable to load live readings: {readingError}
        </p>
      )}

      <section className="graph-section">
        <div className="section-title">
          <div>
            <p className="eyebrow">DATASET VISUALIZATION</p>
            <h2>Sensor reading graph</h2>
          </div>
        </div>

        {datasetLoading ? (
          <div className="message">Loading graph...</div>
        ) : datasetError ? (
          <div className="message error-message">
            Unable to load dataset: {datasetError}
          </div>
        ) : graphData.length === 0 ? (
          <div className="message">
            No sensor values available for the graph.
          </div>
        ) : (
          <div className="chart-panel">
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={graphData}
                  margin={{
                    top: 15,
                    right: 20,
                    left: 5,
                    bottom: 10,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />

                  <XAxis
                    dataKey="sample"
                    label={{
                      value: "Dataset sample",
                      position: "insideBottom",
                      offset: -5,
                    }}
                  />

                  <YAxis />
                  <Tooltip />
                  <Legend />

                  <Line
                    type="monotone"
                    dataKey="MQ4"
                    stroke="#438052"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />

                  <Line
                    type="monotone"
                    dataKey="MQ135"
                    stroke="#d49a48"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (authLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading FruitGuard...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <Dashboard user={user} />;
}
