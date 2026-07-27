import 'dart:async';
import 'package:flutter/material.dart';
import 'login_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {

  late AnimationController controller;

  @override
  void initState() {
    super.initState();

    controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );

    controller.forward();

    Timer(const Duration(seconds: 3),() {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => const LoginScreen(),
        ),
      );
    });
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {

    return Scaffold(

      body: Container(

        width: double.infinity,

        decoration: const BoxDecoration(

          gradient: LinearGradient(

            colors: [

              Color(0xff050816),
              Color(0xff0F172A),
              Color(0xff1E3A8A),

            ],

            begin: Alignment.topLeft,

            end: Alignment.bottomRight,

          ),

        ),

        child: Center(

          child: FadeTransition(

            opacity: controller,

            child: Column(

              mainAxisAlignment: MainAxisAlignment.center,

              children: [

                ScaleTransition(

                  scale: Tween(
                    begin: 0.7,
                    end: 1.0,
                  ).animate(controller),

                  child: Image.asset(

                    "assets/icon.png",

                    width: 130,

                  ),

                ),

                const SizedBox(height: 25),

                const Text(

                  "VedaAI",

                  style: TextStyle(

                    color: Colors.white,

                    fontSize: 34,

                    fontWeight: FontWeight.bold,

                    letterSpacing: 2,

                  ),

                ),

                const SizedBox(height: 8),

                const Text(

                  "Your Smart AI Assistant",

                  style: TextStyle(

                    color: Colors.white70,

                    fontSize: 16,

                  ),

                ),

                const SizedBox(height: 40),

                const CircularProgressIndicator(

                  color: Colors.white,

                ),

                const SizedBox(height: 50),

                const Text(

                  "Created by Yash Patil",

                  style: TextStyle(

                    color: Colors.white54,

                    fontSize: 13,

                  ),

                ),

              ],

            ),

          ),

        ),

      ),

    );

  }
}