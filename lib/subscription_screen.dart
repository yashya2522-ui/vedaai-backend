import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'main.dart';

class SubscriptionScreen extends StatefulWidget {
  const SubscriptionScreen({super.key});

  @override
  State<SubscriptionScreen> createState() =>
      _SubscriptionScreenState();
}

class _SubscriptionScreenState
    extends State<SubscriptionScreen> {

  String role = "user";
  bool isPremium = false;
  String subscriptionType = "free";


  Future<void> selectPlan(String plan) async {

    final prefs =
        await SharedPreferences.getInstance();


    await prefs.setString(
      "selectedPlan",
      plan,
    );


    ScaffoldMessenger.of(context).showSnackBar(

      SnackBar(
        content: Text(
          "$plan plan selected",
        ),
      ),

    );

  }


  @override
  void initState() {
    super.initState();
    loadUser();
  }

  Future<void> loadUser() async {

    final prefs =
        await SharedPreferences.getInstance();

    setState(() {

      role =
          prefs.getString("role") ?? "user";

      isPremium =
          prefs.getBool("isPremium") ?? false;

      subscriptionType =
          prefs.getString("subscriptionType") ??
              "free";

    });

  }

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

  if (role == "owner")
    Card(
      color: Colors.amber.shade100,
      elevation: 8,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [

            const Icon(
              Icons.verified,
              color: Colors.orange,
              size: 60,
            ),

            const SizedBox(height: 10),

            const Text(
              "OWNER ACCOUNT",
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),

            const SizedBox(height: 10),

            const Text(
              "Lifetime Premium Active",
              style: TextStyle(
                fontSize: 18,
                color: Colors.green,
              ),
            ),

            const SizedBox(height: 5),

            Text(
              "Current Plan : $subscriptionType",
              style: const TextStyle(
                fontSize: 16,
              ),
            ),

            const SizedBox(height: 10),

            const Text(
              "No Payment Required",
              style: TextStyle(
                color: Colors.red,
                fontWeight: FontWeight.bold,
              ),
            ),

          ],
        ),
      ),
    ),

  const SizedBox(height: 20),

              
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
      children: [

        const Text(
          "🆓 Free Plan",
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.bold,
          ),
        ),

        const SizedBox(height: 10),

        const Text("✔ Limited AI Chat"),
        const Text("✔ Limited PDF"),
        const Text("✔ Limited Images"),
        const Text("✔ Community Support"),

        const SizedBox(height: 15),

        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () {

              Navigator.pushReplacement(
                context,
                MaterialPageRoute(
                  builder: (context) => const ChatScreen(),
                ),
              );

            },
            child: const Text("Continue Free"),
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
    onPressed: () {

      showDialog(
        context: context,
        builder: (context) {

          return AlertDialog(

            title: const Text(
              "Upgrade to Premium 💎",
            ),

            content: const Text(
              "Get Unlimited AI Chat, PDF, Images and Voice AI for ₹199/month.",
            ),

            actions: [

              TextButton(
                onPressed: () {

                  Navigator.pop(context);

                },
                child: const Text("Cancel"),
              ),


              ElevatedButton(
  onPressed: () {

    Navigator.pop(context);

    selectPlan("monthly");

  },
  child: const Text(
    "Continue",
  ),
),

            ],

          );

        },
      );

    },
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
    onPressed: () {

      showDialog(
        context: context,
        builder: (context) {

          return AlertDialog(

            title: const Text(
              "Upgrade to Premium 👑",
            ),

            content: const Text(
              "Get all premium features for ₹1499/year.",
            ),

            actions: [

              TextButton(
                onPressed: () {

                  Navigator.pop(context);

                },
                child: const Text("Cancel"),
              ),


              ElevatedButton(
  onPressed: () {

    Navigator.pop(context);

    selectPlan("yearly");

  },
  child: const Text(
    "Continue",
  ),
),

            ],

          );

        },
      );

    },
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