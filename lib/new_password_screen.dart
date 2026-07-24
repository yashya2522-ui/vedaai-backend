import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;


class NewPasswordScreen extends StatefulWidget {

  final String email;

  const NewPasswordScreen({

    super.key,

    required this.email,

  });


  @override
  State<NewPasswordScreen> createState() =>
      _NewPasswordScreenState();

}



class _NewPasswordScreenState
    extends State<NewPasswordScreen> {


  final passwordController =
      TextEditingController();


  final confirmController =
      TextEditingController();


  bool loading = false;



  Future<void> resetPassword() async {


    if(passwordController.text != confirmController.text){

      ScaffoldMessenger.of(context).showSnackBar(

        const SnackBar(

          content: Text(
            "Passwords do not match"
          ),

        ),

      );

      return;

    }


    setState(() {

      loading = true;

    });



    try {


      final response = await http.post(

        Uri.parse(

          "https://vedaai-backend-5.onrender.com/reset-password"

        ),


        headers: {

          "Content-Type":"application/json"

        },


        body: jsonEncode({

          "email": widget.email,

          "password":
              passwordController.text.trim()

        }),


      );



      final data = jsonDecode(response.body);



      if(response.statusCode == 200){


        ScaffoldMessenger.of(context).showSnackBar(

          SnackBar(

            content: Text(

              data["message"]

            ),

          ),

        );


        Navigator.popUntil(

          context,

          (route) => route.isFirst,

        );


      }

      else{


        ScaffoldMessenger.of(context).showSnackBar(

          SnackBar(

            content: Text(

              data["error"]

            ),

          ),

        );


      }



    }

    catch(e){


      ScaffoldMessenger.of(context).showSnackBar(

        SnackBar(

          content: Text(

            e.toString()

          ),

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

        title: const Text(
          "Create New Password"
        ),

      ),



      body: Padding(

        padding: const EdgeInsets.all(20),


        child: Column(


          children: [



            TextField(

              controller: passwordController,

              obscureText: true,

              decoration: const InputDecoration(

                labelText:
                    "New Password",

              ),

            ),



            const SizedBox(height:20),



            TextField(

              controller: confirmController,

              obscureText: true,

              decoration: const InputDecoration(

                labelText:
                    "Confirm Password",

              ),

            ),



            const SizedBox(height:20),



            ElevatedButton(

              onPressed:
                  loading ? null : resetPassword,


              child: loading

                  ? const CircularProgressIndicator()

                  : const Text(
                      "Reset Password"
                    ),


            )


          ],

        ),

      ),

    );


  }


}