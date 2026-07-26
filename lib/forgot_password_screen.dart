import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'otp_screen.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState
    extends State<ForgotPasswordScreen> {

  final TextEditingController emailController =
      TextEditingController();

  bool loading = false;

  @override
  void dispose() {
    emailController.dispose();
    super.dispose();
  }
  
Future<void> sendOTP() async {

  setState(() {
    loading = true;
  });

  try {

    final response = await http.post(
      Uri.parse(
        "https://vedaai-backend-production-bf1d.up.railway.app/send-otp"
      ),

      headers: {
        "Content-Type": "application/json"
      },

      body: jsonEncode({
        "email": emailController.text.trim()
      }),

    );

    final data = jsonDecode(response.body);

    if (response.statusCode == 200) {

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(data["message"]),
        ),
      );

      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => OtpScreen(
            email: emailController.text.trim(),
          ),
        ),
      );

    } else {

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(data["error"] ?? "Something went wrong"),
        ),
      );

    }


  } catch (e) {

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(e.toString()),
      ),
    );

  } finally {

    if (mounted) {
      setState(() {
        loading = false;
      });
    }

  }

}

  @override
  Widget build(BuildContext context) {

    return Scaffold(

      appBar: AppBar(
        title: const Text("Forgot Password"),
      ),

      body: Padding(

        padding: const EdgeInsets.all(20),

        child: Column(

          crossAxisAlignment: CrossAxisAlignment.stretch,

          children: [

            const SizedBox(height: 20),

            TextField(

              controller: emailController,

              keyboardType: TextInputType.emailAddress,

              decoration: const InputDecoration(

                labelText: "Email",

                border: OutlineInputBorder(),

              ),

            ),

            const SizedBox(height: 20),

            ElevatedButton(

              onPressed: loading ? null : sendOTP,

              child: loading
                  ? const CircularProgressIndicator()
                  : const Text("Send OTP"),

            ),

          ],

        ),

      ),

    );

  }

}