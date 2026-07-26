import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'main.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:razorpay_flutter/razorpay_flutter.dart';

class SubscriptionScreen extends StatefulWidget {
  const SubscriptionScreen({super.key});
  @override
  State<SubscriptionScreen> createState() =>
      _SubscriptionScreenState();
}

class _SubscriptionScreenState
    extends State<SubscriptionScreen> {
 late Razorpay razorpay;

  String role = "user";
  bool isPremium = false;
  String subscriptionType = "free";
  DateTime? subscriptionExpiry;

  Future<void> selectPlan(String plan) async {

    final prefs =
        await SharedPreferences.getInstance();
String? userId = prefs.getString("userId");

    await prefs.setString(
      "selectedPlan",
      plan,
    );
final response = await http.post(

  Uri.parse(
    "https://vedaai-backend-production-bf1d.up.railway.app/activate-premium"
  ),

  headers: {
    "Content-Type": "application/json",
  },

  body: jsonEncode({

    "userId": userId,

    "plan": plan,

  }),

);

final data = jsonDecode(response.body);
print("Selected Plan: ${prefs.getString("selectedPlan")}");
if (response.statusCode == 200) {

  await prefs.setBool(
    "isPremium",
    data["isPremium"],
  );

  await prefs.setString(
    "subscriptionType",
    data["subscriptionType"],
  );


await prefs.setString(
  "subscriptionExpiry",
  data["subscriptionExpiry"]?.toString() ?? "",
);
  }
  
ScaffoldMessenger.of(context).showSnackBar(

  SnackBar(

    content: Text(
      data["message"] ?? "$plan activated",
    ),

  ),

);

  }


 @override
void initState() {
  super.initState();

  razorpay = Razorpay();

  razorpay.on(
    Razorpay.EVENT_PAYMENT_SUCCESS,
    handlePaymentSuccess,
  );

  razorpay.on(
    Razorpay.EVENT_PAYMENT_ERROR,
    handlePaymentError,
  );

  razorpay.on(
    Razorpay.EVENT_EXTERNAL_WALLET,
    handleExternalWallet,
  );

  loadUser();
} 
Future<void> handlePaymentSuccess(
    PaymentSuccessResponse response) async {

  final prefs = await SharedPreferences.getInstance();

  String? userId = prefs.getString("userId");

  final verifyResponse = await http.post(
    Uri.parse(
      "https://vedaai-backend-production-bf1d.up.railway.app/verify-payment"
    ),
    headers: {
      "Content-Type": "application/json",
    },
    body: jsonEncode({
      "userId": userId,
      "plan": prefs.getString("selectedPlan"),
      "razorpay_order_id": response.orderId,
      "razorpay_payment_id": response.paymentId,
      "razorpay_signature": response.signature,
    }),
  );

  final data = jsonDecode(verifyResponse.body);

  if (data["success"]) {

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text("Premium Activated 👑"),
      ),
    );

    loadUser();

  } else {

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(data["message"]),
      ),
    );

  }

}


void handlePaymentError(PaymentFailureResponse response) {

  print("Payment Failed");

}


void handleExternalWallet(ExternalWalletResponse response) {

  print("External Wallet");

}

Future<void> openCheckout(String plan) async {

  final response = await http.post(
    Uri.parse(
      "https://vedaai-backend-production-bf1d.up.railway.app/create-order"
    ),
    headers: {
      "Content-Type": "application/json",
    },
    body: jsonEncode({
      "plan": plan,
    }),
  );


  final data = jsonDecode(response.body);

  var options = {
    'key': 'YOUR_RAZORPAY_TEST_KEY',
    'amount': data["order"]["amount"],
    'name': 'VedaAI',
    'description': '$plan Premium Plan',
    'order_id': data["order"]["id"],
    'prefill': {
      'contact': '',
      'email': '',
    }
  };


  razorpay.open(options);

}

  Future<void> loadUser() async {

    final prefs =
        await SharedPreferences.getInstance();
    String? expiry =
    prefs.getString("subscriptionExpiry");
    setState(() {
      
      subscriptionExpiry =
    expiry != null
        ? DateTime.parse(expiry)
        : null; 

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
 
if (role != "owner" && isPremium)
  Card(
    color: Colors.green.shade100,
    elevation: 8,
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [

          const Icon(
            Icons.workspace_premium,
            color: Colors.green,
            size: 60,
          ),

          const SizedBox(height: 10),

          const Text(
            "Premium Active",
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),

          const SizedBox(height: 10),

          Text(
            "Plan : $subscriptionType",
            style: const TextStyle(fontSize: 18),
          ),
          
          const SizedBox(height: 8),

if (subscriptionExpiry != null)
  Text(
    "Expires : ${subscriptionExpiry!.day}/${subscriptionExpiry!.month}/${subscriptionExpiry!.year}",
    style: const TextStyle(
      fontSize: 16,
      color: Colors.red,
    ),
  ),

          const SizedBox(height: 15),

          ElevatedButton(
            onPressed: () {
              openCheckout(subscriptionType);
            },
            child: const Text("Renew Premium"),
          ),

        ],
      ),
    ),
  ),
  
      if (!isPremium) ...[

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
      ],
const SizedBox(height: 20),
      if (!isPremium)

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

    openCheckout("monthly");

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
      if (!isPremium)

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

    openCheckout("yearly");

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
