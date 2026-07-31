import "./../App.css";
import { Link } from "react-router-dom";


function Home() {
const openRazorpay = async () => {

  console.log("Premium clicked");

  try {

    const orderResponse = await fetch(
      "http://localhost:3000/create-order",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({
          plan: "monthly"
        })
      }
    );

    const orderData = await orderResponse.json();

    console.log(orderData);

    if (!orderData.success) {
      alert(orderData.message || "Order failed");
      return;
    }

    const order = orderData.order;

    const options = {
      key: "rzp_test_THkZEInKs5IhSL",
      amount: order.amount,
      currency: order.currency,
      name: "VedaAI",
      description: "Premium Subscription",
      order_id: order.id,

      handler: async function (response) {

        const verifyResponse = await fetch(
          "http://localhost:3000/verify-payment",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer " + localStorage.getItem("token")
            },
            body: JSON.stringify(response)
          }
        );

        const result = await verifyResponse.json();

        if (result.success) {
          alert("Premium Activated 🎉");
        } else {
          alert(result.message || "Verification failed");
        }
      },

      theme: {
        color: "#00e5ff"
      }
    };

    const razorpay = new window.Razorpay(options);
    razorpay.open();

  } catch (err) {
    console.log(err);
    alert("Something went wrong");
  }
};

  return (
    <div className="app">

      <nav className="navbar">

  <div className="logo">
    <span>🤖</span>
    VedaAI
  </div>


  <div className="nav-links">

    <Link to="/contact">
      Contact
    </Link>

    <Link to="/login">
      <button className="nav-btn">
        Login
      </button>
    </Link>

  </div>

</nav>

     <section className="hero hero-animation">

        <h1>
          Your Personal AI Assistant
        </h1>

        <p>
          Chat, PDF Analysis, Image AI and much more with VedaAI.
        </p>

        <div className="buttons">

          <a href="/VedaAI.apk" download>
            <button className="download">
              Download APK
            </button>
          </a>

         <button
  className="premium"
  onClick={openRazorpay}
>
  Get Premium
</button>

        </div>

      </section>

      <section className="features">

  <h2>VedaAI Features</h2>

  <div className="cards">


    <Link to="/chat" className="feature-link">

      <div className="card feature-card">

        🤖

        <h3>
          AI Chat
        </h3>

        <p>
          Chat with VedaAI and ask anything.
        </p>

      </div>

    </Link>



    <div className="card feature-card">

      📄

      <h3>
        PDF Chat
      </h3>

      <p>
        Upload PDF inside AI Chat.
      </p>

    </div>



    <div className="card feature-card">

      🖼️

      <h3>
        Image AI
      </h3>

      <p>
        Analyze images inside AI Chat.
      </p>

    </div>


  </div>

</section>
            <section className="download-section">

        <h2>📥 Download VedaAI App</h2>

        <p>
          Get the VedaAI Android app and experience AI Chat,
          PDF Analysis, Image AI and more.
        </p>

        <a href="/VedaAI.apk" download>
          <button className="download-btn">
            Download APK
          </button>
        </a>

      </section>


      <section className="faq">

        <h2>❓ Frequently Asked Questions</h2>

        <div className="faq-card">
          <h3>What is VedaAI?</h3>
          <p>
            VedaAI is your personal AI assistant for chat,
            PDF analysis and image AI.
          </p>
        </div>

        <div className="faq-card">
          <h3>How can I download VedaAI?</h3>
          <p>
            Click on Download APK button and install the app.
          </p>
        </div>

        <div className="faq-card">
          <h3>What is VedaAI Premium?</h3>
          <p>
            Premium gives access to advanced AI features.
          </p>
        </div>

      </section>


      <section className="pricing">

<h2>💎 VedaAI Premium</h2>

<div className="pricing-cards">


<div className="price-card yearly-card">

 <div className="badge">
  BEST VALUE
</div>   

<h3>Monthly Plan</h3>

<h1>₹199 / Month</h1>

<p>
✅ Unlimited AI Chat
<br/>
✅ PDF Analysis
<br/>
✅ Image AI
<br/>
✅ Priority Response
</p>

<button 
className="premium"
onClick={() => openRazorpay("monthly")}
>
Get Monthly Premium
</button>

</div>



<div className="price-card">

<h3>Yearly Plan</h3>

<h1>₹1999 / Year</h1>

<p>
✅ Unlimited AI Chat
<br/>
✅ PDF Analysis
<br/>
✅ Image AI
<br/>
✅ Priority Response
<br/>
✅ Save Money
</p>

<button 
className="premium"
onClick={() => openRazorpay("yearly")}
>
Get Yearly Premium
</button>

</div>


</div>

</section>


      <section className="contact">

        <h2>📞 Contact Us</h2>

        <p>Have questions? Contact VedaAI support.</p>

        <p>Email: support@vedaai.com</p>

      </section>


    <footer className="footer">

  <p>© 2026 VedaAI. All Rights Reserved.</p>

 <div>

  <Link to="/privacy">
    Privacy Policy
  </Link>

  <Link to="/terms">
    Terms & Conditions
  </Link>

  <Link to="/contact">
    Contact Us
  </Link>

</div>

</footer>

    </div>
  );
}

export default Home;