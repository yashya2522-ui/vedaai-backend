import 'package:flutter/material.dart';

class SubscriptionScreen extends StatelessWidget {
  const SubscriptionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("VedaAI Premium"),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
  padding: const EdgeInsets.all(20),
  child: Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [

      const Icon(
        Icons.workspace_premium,
        size: 90,
        color: Colors.amber,
      ),

      const SizedBox(height: 15),

      const Text(
        "VedaAI Premium",
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: 30,
          fontWeight: FontWeight.bold,
        ),
      ),

      const SizedBox(height: 8),

      const Text(
        "Unlock all AI features",
        textAlign: TextAlign.center,
      ),

      const SizedBox(height: 30),

      Card(
        elevation: 5,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [

              Text(
                "🆓 Free Plan",
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                ),
              ),

              SizedBox(height: 10),

              Text("✔ Limited AI Chat"),
              Text("✔ Limited PDF"),
              Text("✔ Limited Images"),
              Text("✔ Community Support"),

            ],
          ),
        ),
      ),

      const SizedBox(height: 20),

      Card(
        elevation: 8,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [

              const Text(
                "💎 Premium Monthly",
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                ),
              ),

              const SizedBox(height: 10),

              const Text(
                "₹199 / Month",
                style: TextStyle(
                  fontSize: 20,
                  color: Colors.green,
                  fontWeight: FontWeight.bold,
                ),
              ),

              const SizedBox(height: 10),

              const Text("✔ Unlimited AI Chat"),
              const Text("✔ Unlimited PDF"),
              const Text("✔ Unlimited Images"),
              const Text("✔ Voice AI"),
              const Text("✔ Faster Responses"),

              const SizedBox(height: 15),

              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {},
                  child: const Text("Subscribe"),
                ),
              ),

            ],
          ),
        ),
      ),

      const SizedBox(height: 20),

      Card(
        elevation: 8,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [

              const Text(
                "👑 Premium Yearly",
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                ),
              ),

              const SizedBox(height: 10),

              const Text(
                "₹1499 / Year",
                style: TextStyle(
                  fontSize: 20,
                  color: Colors.green,
                  fontWeight: FontWeight.bold,
                ),
              ),

              const SizedBox(height: 10),

              const Text("✔ Everything in Monthly"),
              const Text("✔ Best Value"),
              const Text("✔ Early Access Features"),

              const SizedBox(height: 15),

              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {},
                  child: const Text("Subscribe"),
                ),
              ),

            ],
          ),
        ),
      ),

    ],
  ),
),
    );
  }
}