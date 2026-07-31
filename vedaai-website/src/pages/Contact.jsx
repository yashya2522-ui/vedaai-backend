import "./../App.css";

function Contact() {

  return (
    <div className="app">

      <section className="hero">

        <h1>
          Contact VedaAI
        </h1>

        <p>
          Have questions or need support? Contact us.
        </p>

      </section>


      <section className="contact">

        <div className="faq-card">

          <h2>
            📞 Support
          </h2>

          <p>
            For any queries related to VedaAI,
            please contact our support team.
          </p>

        </div>


        <div className="faq-card">

          <h2>
            📧 Email
          </h2>

          <p>
            support@vedaai.com
          </p>

        </div>


        <div className="faq-card">

          <h2>
            🤖 About VedaAI
          </h2>

          <p>
            VedaAI is an AI assistant platform providing
            AI Chat, PDF Analysis and Image AI features.
          </p>

        </div>

      </section>

    </div>
  );
}

export default Contact;