import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'register_screen.dart';
import 'forgot_password_screen.dart';

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


  Future<void> login() async {


    setState(() {
      loading = true;
    });


    try {

      final response = await http.post(

        Uri.parse(
          "https://vedaai-backend-5.onrender.com/login"
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


        Navigator.pushReplacement(

          context,

          MaterialPageRoute(

            builder:(context)=> const ChatScreen(),

          ),

        );


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

      appBar: AppBar(

        title: const Text("VedaAI Login"),

      ),


      body: Padding(

        padding: const EdgeInsets.all(20),


        child: Column(

          children: [


            TextField(

              controller: emailController,

              decoration: const InputDecoration(

                labelText:"Email"

              ),

            ),


            TextField(

              controller: passwordController,

              obscureText:true,

              decoration: const InputDecoration(

                labelText:"Password"

              ),

            ),


            const SizedBox(height:20),


           ElevatedButton(

  onPressed: loading ? null : login,

  child: loading
      ? const CircularProgressIndicator()
      : const Text("Login"),

),

const SizedBox(height: 10),

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
  ),

),

const SizedBox(height: 10),

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
  ),

),
          ],

        ),

      ),

    );

  }

}