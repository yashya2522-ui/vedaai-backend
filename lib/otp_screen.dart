import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'new_password_screen.dart';

class OtpScreen extends StatefulWidget {

  final String email;

  const OtpScreen({
    super.key,
    required this.email,
  });

  @override
  State<OtpScreen> createState() => _OtpScreenState();

}

class _OtpScreenState extends State<OtpScreen> {

  final otpController = TextEditingController();

  bool loading = false;

  Future<void> verifyOTP() async {

    setState(() {
      loading = true;
    });

    try {

      final response = await http.post(

        Uri.parse(
          "https://vedaai-backend-5.onrender.com/verify-otp"
        ),

        headers: {

          "Content-Type":"application/json"

        },

        body: jsonEncode({

          "email": widget.email,

          "otp": otpController.text.trim()

        }),

      );

      final data = jsonDecode(response.body);

      if(response.statusCode==200){

        Navigator.pushReplacement(

          context,

          MaterialPageRoute(

            builder: (_) => NewPasswordScreen(

              email: widget.email,

            ),

          ),

        );

      }

      else{

        ScaffoldMessenger.of(context).showSnackBar(

          SnackBar(

            content: Text(data["error"]),

          ),

        );

      }

    }

    catch(e){

      ScaffoldMessenger.of(context).showSnackBar(

        SnackBar(

          content: Text(e.toString()),

        ),

      );

    }

    setState(() {

      loading=false;

    });

  }

  @override
  Widget build(BuildContext context) {

    return Scaffold(

      appBar: AppBar(

        title: const Text("Verify OTP"),

      ),

      body: Padding(

        padding: const EdgeInsets.all(20),

        child: Column(

          children: [

            TextField(

              controller: otpController,

              keyboardType: TextInputType.number,

              decoration: const InputDecoration(

                labelText: "Enter OTP",

              ),

            ),

            const SizedBox(height:20),

            ElevatedButton(

              onPressed: loading ? null : verifyOTP,

              child: loading

                  ? const CircularProgressIndicator()

                  : const Text("Verify OTP"),

            )

          ],

        ),

      ),

    );

  }

}