import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'register_screen.dart';
import 'forgot_password_screen.dart';
import 'subscription_screen.dart';
import 'main.dart';

class LoginScreen extends StatefulWidget {

  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();

}


class _LoginScreenState extends State<LoginScreen> {


  final emailController = TextEditingController();
  final passwordController = TextEditingController();


  bool loading = false;
  bool hidePassword = true;

  Future<void> login() async {


    setState(() {
      loading = true;
    });


    try {

      final response = await http.post(

        Uri.parse(
          "https://vedaai-backend-production-bf1d.up.railway.app/login"
        ),

        headers: {

          "Content-Type":"application/json"

        },

        body: jsonEncode({

          "email": emailController.text.trim(),

          "password": passwordController.text.trim()

        }),

      );


      final data = jsonDecode(response.body);


      if(response.statusCode == 200){


        final prefs = await SharedPreferences.getInstance();


        await prefs.setString(
  "token",
  data["token"],
);

await prefs.setString(
  "userId",
  data["userId"],
);

await prefs.setString(
  "name",
  data["name"] ?? "User",
);

await prefs.setString(
  "role",
  data["role"],
);

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
        if (data["role"] == "owner" || data["isPremium"] == true) {

  Navigator.pushReplacement(
    context,
    MaterialPageRoute(
      builder: (context) => const ChatScreen(),
    ),
  );

} else {

  Navigator.pushReplacement(
    context,
    MaterialPageRoute(
      builder: (context) => const SubscriptionScreen(),
    ),
  );

}

      }

      else {


        ScaffoldMessenger.of(context).showSnackBar(

          SnackBar(

            content: Text(
              data["error"] ?? "Login Failed"
            ),

          ),

        );


      }


    }

    catch(e){

      print(e);

    }


    setState(() {

      loading=false;

    });


  }



  @override
  Widget build(BuildContext context) {


   return Scaffold(
  body: Container(
    width: double.infinity,
    height: double.infinity,

    decoration: const BoxDecoration(
      gradient: const LinearGradient(

  begin: Alignment.topLeft,

  end: Alignment.bottomRight,

  colors: [

    Color(0xff2563EB),

    Color(0xff4F46E5),

    Color(0xff7C3AED),

  ],

),
    ),

    child: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [

                Image.asset(
                  "assets/icon.png",
                  width: 110,
                ),

                const SizedBox(height: 20),

                const Text(
                  "VedaAI",
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 34,
                    fontWeight: FontWeight.bold,
                  ),
                ),

                const SizedBox(height: 8),

                const Text(
                  "Welcome Back",
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 18,
                  ),
                ),

                const SizedBox(height: 35),
 
 


Container(

  padding: const EdgeInsets.symmetric(
    horizontal: 22,
    vertical: 24,
  ),

  width: double.infinity,

  decoration: BoxDecoration(

    color: Colors.white.withOpacity(0.08),

    borderRadius: BorderRadius.circular(28),

    border: Border.all(

      color: Colors.white.withOpacity(0.18),

      width: 1.2,

    ),

    boxShadow: [

      BoxShadow(

        color: Colors.black.withOpacity(0.30),

        blurRadius: 30,

        spreadRadius: 2,

        offset: const Offset(0,12),

      ),

    ],

  ),

  


  child: Column(

    children: [



            
             TextField(
  controller: emailController,

  style: const TextStyle(
    color: Colors.white,
  ),

  decoration: InputDecoration(
    labelText: "Email",

    labelStyle: const TextStyle(
      color: Colors.white70,
    ),

    prefixIcon: const Icon(
      Icons.email,
      color: Colors.white70,
    ),

    filled: true,
    fillColor: Colors.white.withOpacity(0.12),

    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(20),
      borderSide: const BorderSide(
        color: Colors.white30,
      ),
    ),

    focusedBorder: OutlineInputBorder(

  borderRadius: BorderRadius.circular(20),

  borderSide: const BorderSide(

    color: Color(0xff60A5FA),

    width: 2,

  ),

),
  ),
),


         TextField(

  controller: passwordController,

  obscureText: hidePassword,

  style: const TextStyle(
    color: Colors.white,
  ),

  decoration: InputDecoration(

    labelText: "Password",

    labelStyle: const TextStyle(
      color: Colors.white70,
    ),

    suffixIcon: IconButton(

      icon: Icon(

        hidePassword
            ? Icons.visibility_off
            : Icons.visibility,

        color: Colors.white70,

      ),

      onPressed: () {

        setState(() {

          hidePassword = !hidePassword;

        });

      },

    ),

  ),

),
            
            const SizedBox(height:16),


           GestureDetector(

  onTap: loading ? null : login,

  child: Container(

    width: double.infinity,

    height: 55,

    decoration: BoxDecoration(

      gradient: const LinearGradient(

        colors: [
          Color(0xff2563EB),
          Color(0xff7C3AED),
        ],

      ),

      borderRadius: BorderRadius.circular(20),


      boxShadow: [

  BoxShadow(

    color: Colors.blue.withOpacity(0.35),

    blurRadius: 20,

    spreadRadius: 2,

    offset: const Offset(0,8),

  ),

],

    ),

    child: Center(

      child: loading

          ? const CircularProgressIndicator(
              color: Colors.white,
            )

          : const Text(

              "Login",

              style: TextStyle(

                color: Colors.white,

                fontSize: 18,

                fontWeight: FontWeight.bold,

              ),

            ),

    ),

  ),

),

const SizedBox(height: 16),

TextButton(

  onPressed: () {

    Navigator.push(

      context,

      MaterialPageRoute(

        builder: (context) =>
            const ForgotPasswordScreen(),

      ),

    );

  },

  child: const Text(

    "Forgot Password?",

    style: TextStyle(

      color: Colors.white70,

      fontSize: 15,

    ),

  ),

),

  

const SizedBox(height: 8),

TextButton(

  onPressed: () {

    Navigator.push(

      context,

      MaterialPageRoute(

        builder: (context) =>
            const RegisterScreen(),

      ),

    );

  },

  child: const Text(

    "Create new account",

    style: TextStyle(

      color: Colors.white,

      fontSize: 16,

      fontWeight: FontWeight.bold,

    ),

  ),

),
 ],
  ),

),
                           ],
            ),
          ),
        ),
      ),
    ),
  ),
);
}

}