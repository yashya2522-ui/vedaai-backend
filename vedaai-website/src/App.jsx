import "./App.css";
import { Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Contact from "./pages/Contact";
import Chat from "./pages/Chat";

function App() {
  return (
    <Routes>

      <Route path="/" element={<Home />} />

      <Route path="/login" element={<Login />} />

      <Route path="/signup" element={<Signup />} />

      <Route path="/privacy" element={<Privacy />} />
      
      <Route path="/terms" element={<Terms />} />
      
      <Route path="/contact" element={<Contact />} />
      
      <Route path="/chat" element={<Chat />} />
      
    </Routes>
  );
}

export default App;