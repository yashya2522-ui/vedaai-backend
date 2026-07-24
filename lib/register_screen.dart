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


  Future<void> signup() async {


    setState(() {
      loading = true;
    });


    try {


      final response = await http.post(

        Uri.parse(
          "https://vedaai-backend-5.onrender.com/signup"
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

      appBar: AppBar(

        title: const Text("Create Account"),

      ),


      body: Padding(

        padding: const EdgeInsets.all(20),


        child: Column(

          children: [


            TextField(

              controller:nameController,

              decoration:const InputDecoration(

                labelText:"Name"

              ),

            ),



            TextField(

              controller:emailController,

              decoration:const InputDecoration(

                labelText:"Email"

              ),

            ),



            TextField(

              controller:passwordController,

              obscureText:true,

              decoration:const InputDecoration(

                labelText:"Password"

              ),

            ),



            const SizedBox(height:20),



            ElevatedButton(

              onPressed:
              loading ? null : signup,


              child: loading

              ? const CircularProgressIndicator()

              : const Text("Signup"),

            )


          ],

        ),

      ),

    );

  }

}