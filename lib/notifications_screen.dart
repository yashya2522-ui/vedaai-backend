import 'package:flutter/material.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      
      appBar: AppBar(
        title: const Text("Notifications"),
      ),
      body: ListView(
        children: const [

          ListTile(
            leading: CircleAvatar(
              child: Icon(Icons.waving_hand),
            ),
            title: Text("Welcome to VedaAI"),
            subtitle: Text("Thanks for joining VedaAI."),
          ),

          Divider(),

          ListTile(
            leading: CircleAvatar(
              child: Icon(Icons.lightbulb),
            ),
            title: Text("Quick Tip"),
            subtitle: Text(
              "Long press any chat to add it to Favorites.",
            ),
          ),

          Divider(),

          ListTile(
            leading: CircleAvatar(
              child: Icon(Icons.system_update),
            ),
            title: Text("Latest Version"),
            subtitle: Text(
              "You are using the latest version.",
            ),
          ),

          Divider(),

          ListTile(
            leading: CircleAvatar(
              child: Icon(Icons.workspace_premium),
            ),
            title: Text("Premium"),
            subtitle: Text(
              "Upgrade to unlock unlimited AI.",
            ),
          ),

        ],
      ),
    );
  }
}