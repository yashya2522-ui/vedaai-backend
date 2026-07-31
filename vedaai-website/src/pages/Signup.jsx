import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Signup() {

  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
const navigate = useNavigate();

const handleSignup = async () => {
  try {
    const response = await fetch("http://localhost:3000/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Signup failed");
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("name", data.name);

    alert("Signup Successful ✅");

    navigate("/");
  } catch (err) {
    console.log(err);
    alert("Server Error");
  }
};

  return (

    <div style={{padding:40}}>

      <h2>Signup</h2>

      <input
      placeholder="Name"
      value={name}
      onChange={(e)=>setName(e.target.value)}
      />

      <br/><br/>

      <input
      placeholder="Email"
      value={email}
      onChange={(e)=>setEmail(e.target.value)}
      />

      <br/><br/>

      <input
      type="password"
      placeholder="Password"
      value={password}
      onChange={(e)=>setPassword(e.target.value)}
      />

      <br/><br/>
<button onClick={handleSignup}>
  Signup
</button>

    </div>

  );
}

export default Signup;