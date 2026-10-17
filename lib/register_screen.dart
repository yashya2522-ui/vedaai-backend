import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'main.dart';


class RegisterScreen extends StatefulWidget {

  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();

}


class _RegisterScreenState extends State<RegisterScreen> {


  final nameController = TextEditingController();
  final emailController = TextEditingController();
  final passwordController = TextEditingController();


  bool loading = false;
 bool hidePassword = true;

  Future<void> signup() async {


    setState(() {
      loading = true;
    });


    try {


      final response = await http.post(

        Uri.parse(
          "https://vedaai-backend-25-2pl4.onrender.com/signup"
        ),

        headers: {

          "Content-Type":"application/json"

        },

        body: jsonEncode({

          "name": nameController.text.trim(),

          "email": emailController.text.trim(),

          "password": passwordController.text.trim()

        }),

      );


      final data = jsonDecode(response.body);


      if(response.statusCode == 200){


        final prefs =
        await SharedPreferences.getInstance();


        await prefs.setString(
          "token",
          data["token"],
        );
        
        await prefs.setString(
  "name",
  nameController.text.trim(),
);


        Navigator.pushReplacement(

          context,

          MaterialPageRoute(

            builder:(context)=>const ChatScreen(),

          ),

        );


      }else{


        ScaffoldMessenger.of(context)
        .showSnackBar(

          SnackBar(

            content: Text(
              data["error"] ?? "Signup failed"
            ),

          ),

        );

      }


    }catch(e){

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
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xff050816),
            Color(0xff0F172A),
            Color(0xff1E3A8A),
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
                    "Create Account",
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
                          offset: const Offset(0, 12),
                        ),
                      ],
                    ),

                    child: Column(
                      children: [

                        TextField(
                          controller: nameController,

                          style: const TextStyle(
                            color: Colors.white,
                          ),

                          decoration: InputDecoration(
                            labelText: "Full Name",

                            labelStyle: const TextStyle(
                              color: Colors.white70,
                            ),

                            prefixIcon: const Icon(
                              Icons.person,
                              color: Colors.white70,
                            ),

                            filled: true,
                            fillColor: Colors.white.withOpacity(0.12),

                            enabledBorder: OutlineInputBorder(
                              borderRadius:
                                  BorderRadius.circular(20),
                              borderSide: const BorderSide(
                                color: Colors.white30,
                              ),
                            ),

                            focusedBorder: OutlineInputBorder(
                              borderRadius:
                                  BorderRadius.circular(20),
                              borderSide: const BorderSide(
                                color: Color(0xff60A5FA),
                                width: 2,
                              ),
                            ),
                          ),
                        ),

                        const SizedBox(height: 16),

                        TextField(
                          controller: emailController,

                          keyboardType:
                              TextInputType.emailAddress,

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
                              borderRadius:
                                  BorderRadius.circular(20),
                              borderSide: const BorderSide(
                                color: Colors.white30,
                              ),
                            ),

                            focusedBorder: OutlineInputBorder(
                              borderRadius:
                                  BorderRadius.circular(20),
                              borderSide: const BorderSide(
                                color: Color(0xff60A5FA),
                                width: 2,
                              ),
                            ),
                          ),
                        ),

                        const SizedBox(height: 16),

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

    prefixIcon: const Icon(
      Icons.lock,
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
                        const SizedBox(height: 24),

                        GestureDetector(
                          onTap: loading ? null : signup,

                          child: Container(
                            width: double.infinity,
                            height: 55,

                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [
                                  Color(0xff2563EB),
                                  Color(0xff4F46E5),
                                  Color(0xff7C3AED),
                                ],
                              ),

                              borderRadius:
                                  BorderRadius.circular(20),
                            ),

                            child: Center(
                              child: loading
                                  ? const CircularProgressIndicator(
                                      color: Colors.white,
                                    )
                                  : const Text(
                                      "Create Account",
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 17,
                                        fontWeight:
                                            FontWeight.bold,
                                      ),
                                    ),
                            ),
                          ),
                        ),

                        const SizedBox(height: 18),

                        TextButton(
                          onPressed: () {
                            Navigator.pop(context);
                          },

                          child: const Text(
                            "Already have an account? Login",
                            style: TextStyle(
                              color: Colors.white70,
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
