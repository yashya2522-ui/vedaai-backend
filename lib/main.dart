import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'package:share_plus/share_plus.dart';
import 'package:path_provider/path_provider.dart';

import 'package:speech_to_text/speech_to_text.dart' as stt;
import 'package:flutter_tts/flutter_tts.dart';

import 'package:loading_animation_widget/loading_animation_widget.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      debugShowCheckedModeBanner: false,
      home: ChatScreen(),
    );
  }
}

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}
class _ChatScreenState extends State<ChatScreen> {

  // 1. CONTROLLERS
  final TextEditingController controller = TextEditingController();
  final ScrollController scrollController = ScrollController();

  // 2. STATE
  bool isDarkMode = false;
  bool isLoading = false;
  bool isListening = false;

  int currentChatIndex = 0;

  List<Map<String, dynamic>> messages = [];

  List<Map<String, dynamic>> allChats = [
    {
      "title": "New Chat",
      "messages": []
    }
  ];

  // 3. API FUNCTION (OK PLACE)
  

  final stt.SpeechToText speech = stt.SpeechToText();
  final FlutterTts flutterTts = FlutterTts();

  @override
  void dispose() {
    controller.dispose();
    scrollController.dispose();
    flutterTts.stop();
    super.dispose();
  }
@override
void initState() {
  super.initState();
  loadChat();
} 

Future<void> exportChat() async {
  try {
    if (messages.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("No messages to export"),
        ),
      );
      return;
    }

    String chatText = "";

    for (var msg in messages) {
      String role = msg["role"] ?? "user";
      String text = msg["text"] ?? "";
      String image = msg["image"] ?? "";
      String time = msg["time"] ?? "";

      chatText += "====================\n";
      chatText += "$role\n";

      if (time.isNotEmpty) {
        chatText += "Time: $time\n";
      }

      chatText += "$text\n";

      if (image.isNotEmpty) {
        chatText += "Image: $image\n";
      }

      if (msg["pinned"] == true) {
        chatText += "Pinned Message\n";
      }

      chatText += "\n";
    }

    final dir = await getApplicationDocumentsDirectory();

    final file = File(
      "${dir.path}/vedaai_chat_export.txt",
    );

    await file.writeAsString(chatText);

    await Share.shareXFiles(
      [XFile(file.path)],
      text: "VedaAI Chat Export",
    );
  } catch (e) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text("Export failed: $e"),
      ),
    );
  }
}

Future<void> speak(String text) async {
  if (text.trim().isEmpty) return;

  await flutterTts.stop();

  await flutterTts.setSpeechRate(0.5);
  await flutterTts.setPitch(1.0);

  if (RegExp(r'[अ-ह]').hasMatch(text)) {
    await flutterTts.setLanguage("hi-IN");
  } else {
    await flutterTts.setLanguage("en-US");
  }

  await flutterTts.speak(text);
}  
Future<void> loadChat() async {
  final prefs = await SharedPreferences.getInstance();
  final data = prefs.getString("allChats");

  if (data == null) {
    setState(() {
      allChats = [
        {
          "title": "New Chat",
          "messages": [],
          "favorite": false,
        }
      ];

      currentChatIndex = 0;
      messages = [];
    });
    return;
  }

  try {
    final decoded = jsonDecode(data);

    allChats = (decoded as List)
        .map((e) => Map<String, dynamic>.from(e))
        .toList();

    setState(() {
      currentChatIndex = 0;

      messages = List<Map<String, dynamic>>.from(
        allChats[0]["messages"] ?? [],
      );
    });

  } catch (e) {
    print("LOAD ERROR: $e");

    setState(() {
      allChats = [
        {
          "title": "New Chat",
          "messages": [],
          "favorite": false,
        }
      ];

      currentChatIndex = 0;
      messages = [];
    });
  }
}
Future<void> saveChat() async {
  try {
    final prefs = await SharedPreferences.getInstance();

    await prefs.setString(
      "allChats",
      jsonEncode(allChats),
    );

    print("Chats Saved");
  } catch (e) {
    print("SAVE ERROR: $e");
  }
} 
Future<void> newChat() async {
  setState(() {
    allChats.add({
      "title": "New Chat",
      "messages": <Map<String, dynamic>>[],
      "favorite": false,
    });

    currentChatIndex = allChats.length - 1;

    messages = [];
  });

  await saveChat();

  scrollToBottom();
}

Future<void> clearChat() async {
  setState(() {
    allChats = [
      {
        "title": "New Chat",
        "messages": <Map<String, dynamic>>[],
        "favorite": false,
      }
    ];

    currentChatIndex = 0;
    messages = [];
  });

  await saveChat();
}
 
String getOfflineResponse(String message) {
  String msg = message.toLowerCase().trim();

  if (msg.contains("hello") || msg.contains("hi")) {
    return "Hello 👋\n\nI am VedaAI running in Offline Mode.";
  }

  if (msg.contains("how are you")) {
    return "I'm doing well 😊\n\nHow can I help you today?";
  }

  if (msg.contains("your name")) {
    return "My name is VedaAI 🤖";
  }

  if (msg.contains("what is ml") ||
      msg.contains("machine learning")) {
    return """
Machine Learning (ML)

Machine Learning is a branch of Artificial Intelligence.

How it works:
1. Collect Data
2. Train Model
3. Learn Patterns
4. Make Predictions

Simple Diagram:

Data
 ↓
Training
 ↓
Model
 ↓
Prediction
""";
  }

  if (msg.contains("what is ai")) {
    return """
Artificial Intelligence (AI)

AI is the ability of computers to perform tasks that normally require human intelligence.

Examples:
• Chatbots
• Face Recognition
• Self Driving Cars
• Voice Assistants
""";
  }

  return """
Offline Mode

Internet or API is unavailable.

Please connect to the internet for a full AI response.
""";
}
Future<String> getAIResponse(String text) async {
  try {
    final url = Uri.parse(
      "https://vedaai-backend-5.onrender.com/chat",
    );

    final res = await http.post(
      url,
      headers: {
        "Content-Type": "application/json",
      },
      body: jsonEncode({
        "message": text,
      }),
    );

    print("STATUS: ${res.statusCode}");
    print("BODY: ${res.body}");

    if (res.statusCode == 200) {
      final data = jsonDecode(res.body);
      return data["reply"] ?? "No response";
    } else {
      return "Server Error: ${res.statusCode}";
    }
  } catch (e) {
    print("ERROR: $e");
    return "ERROR: $e";
  }
}
void sendMessage() async {
  if (controller.text.trim().isEmpty) return;

  String userText = controller.text.trim();

  // first message title set
  if ((allChats[currentChatIndex]["messages"] as List).isEmpty) {
    allChats[currentChatIndex]["title"] =
        userText.length > 25
            ? "${userText.substring(0, 25)}..."
            : userText;
  }

  setState(() {
    allChats[currentChatIndex]["messages"].add({
      "role": "user",
      "text": userText,
      "pinned": false,
    });

    messages = List<Map<String, dynamic>>.from(
      allChats[currentChatIndex]["messages"],
    );

    controller.clear();
    isLoading = true;
  });

  await saveChat();

  try {
    // ✅ ONLY userText send to backend
    String aiText = await getAIResponse(userText);

    // clean response
    aiText = aiText
        .replaceAll("**", "")
        .replaceAll("###", "")
        .replaceAll("##", "")
        .replaceAll("#", "")
        .replaceAll("```", "")
        .trim();

    String aiImage = "";

    // Architecture
    if (userText.toLowerCase().contains("architecture") ||
        userText.toLowerCase().contains("diagram")) {
      aiImage = "https://picsum.photos/800/400";
    }

    // Machine Learning
    if (userText.toLowerCase().contains("machine learning") ||
        userText.toLowerCase().contains("what is ml")) {
      aiImage =
          "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800";
    }

    setState(() {
      allChats[currentChatIndex]["messages"].add({
        "role": "ai",
        "text": aiText,
        "image": aiImage,
        "pinned": false,
      });

      messages = List<Map<String, dynamic>>.from(
        allChats[currentChatIndex]["messages"],
      );

      isLoading = false;
    });

    await saveChat();
    scrollToBottom();
  } catch (e) {
    String offlineReply = getOfflineResponse(userText);

    setState(() {
      allChats[currentChatIndex]["messages"].add({
        "role": "ai",
        "text": offlineReply,
        "pinned": false,
      });

      messages = List<Map<String, dynamic>>.from(
        allChats[currentChatIndex]["messages"],
      );

      isLoading = false;
    });

    await saveChat();
    scrollToBottom();
  }
}

 void scrollToBottom() {
  Future.delayed(const Duration(milliseconds: 100), () {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (scrollController.hasClients) {
        scrollController.animateTo(
          scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  });
}

Future<void> startListening() async {
  bool available = await speech.initialize();

  if (!available) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text("Speech recognition not available"),
      ),
    );
    return;
  }

  setState(() {
    isListening = true;
  });

  speech.listen(
    onResult: (result) {
      setState(() {
        controller.text = result.recognizedWords;
      });
    },

    onSoundLevelChange: (level) {},

    listenFor: const Duration(minutes: 1),
    pauseFor: const Duration(seconds: 5),
  );
}

Future<void> stopListening() async {
  await speech.stop();

  setState(() {
    isListening = false;
  });
} 
Widget chatBubble(Map<String, dynamic> msg) {
  bool isUser = msg["role"] == "user";

  return GestureDetector(
    onLongPress: () {
      showModalBottomSheet(
        context: context,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(20),
          ),
        ),
        builder: (context) {
          return Wrap(
            children: [

              // COPY
              ListTile(
                leading: const Icon(Icons.copy),
                title: const Text("Copy"),
                onTap: () {
                  Clipboard.setData(
                    ClipboardData(
                      text: msg["text"] ?? "",
                    ),
                  );
                  Navigator.pop(context);
                },
              ),

              // SPEAK
              ListTile(
                leading: const Icon(Icons.volume_up),
                title: const Text("Speak"),
                onTap: () {
                  speak(msg["text"] ?? "");
                  Navigator.pop(context);
                },
              ),

              // SHARE
              ListTile(
                leading: const Icon(Icons.share),
                title: const Text("Share"),
                onTap: () {
                  Share.share(msg["text"] ?? "");
                  Navigator.pop(context);
                },
              ),

              // EDIT
              ListTile(
                leading: const Icon(Icons.edit),
                title: const Text("Edit"),
                onTap: () {
                  Navigator.pop(context);

                  TextEditingController editController =
                      TextEditingController(
                    text: msg["text"],
                  );

                  showDialog(
                    context: context,
                    builder: (context) {
                      return AlertDialog(
                        title: const Text("Edit Message"),
                        content: TextField(
                          controller: editController,
                        ),
                        actions: [
                          TextButton(
                            onPressed: () {
                              setState(() {
                                msg["text"] =
                                    editController.text;
                              });

                              saveChat();

                              Navigator.pop(context);
                            },
                            child: const Text("Save"),
                          ),
                        ],
                      );
                    },
                  );
                },
              ),

              // PIN
              ListTile(
                leading: const Icon(Icons.push_pin),
                title: const Text("Pin / Unpin"),
                onTap: () {
                  setState(() {
                    msg["pinned"] =
                        !(msg["pinned"] ?? false);
                  });

                  saveChat();

                  Navigator.pop(context);
                },
              ),

              // DELETE
              ListTile(
                leading: const Icon(Icons.delete),
                title: const Text("Delete"),
                onTap: () {
                  setState(() {
                    (allChats[currentChatIndex]["messages"]
                            as List)
                        .remove(msg);

                    messages =
                        List<Map<String, dynamic>>.from(
                      allChats[currentChatIndex]
                          ["messages"],
                    );
                  });

                  saveChat();

                  Navigator.pop(context);
                },
              ),
            ],
          );
        },
      );
    },

    child: Align(
      alignment: isUser
          ? Alignment.centerRight
          : Alignment.centerLeft,

      child: Container(
        margin: const EdgeInsets.symmetric(
          vertical: 4,
          horizontal: 8,
        ),

        padding: const EdgeInsets.symmetric(
          vertical: 10,
          horizontal: 14,
        ),

        constraints: BoxConstraints(
          maxWidth:
              MediaQuery.of(context).size.width * 0.75,
        ),

        decoration: BoxDecoration(
          color: isUser
              ? const Color(0xFFDCF8C6)
              : (isDarkMode
                  ? Colors.grey[800]
                  : Colors.white),
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(15),
            topRight: const Radius.circular(15),
            bottomLeft:
                Radius.circular(isUser ? 15 : 0),
            bottomRight:
                Radius.circular(isUser ? 0 : 15),
          ),

          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 3,
              offset: const Offset(0, 1),
            ),
          ],
        ),

        child: Column(
          crossAxisAlignment:
              CrossAxisAlignment.start,
          children: [

            // TEXT
            SelectableText(
              msg["text"] ?? "",
              style: TextStyle(
                fontSize: 15,
                height: 1.5,
                color: isUser
                    ? Colors.black87
                    : (isDarkMode
                        ? Colors.white
                        : Colors.black),
              ),
            ),

            // IMAGE
            if (msg["image"] != null &&
                msg["image"]
                    .toString()
                    .isNotEmpty)
              Padding(
                padding:
                    const EdgeInsets.only(top: 10),
                child: ClipRRect(
                  borderRadius:
                      BorderRadius.circular(12),
                  child: Image.network(
                    msg["image"],
                    height: 200,
                    width: double.infinity,
                    fit: BoxFit.cover,

                    loadingBuilder:
                        (context, child, progress) {
                      if (progress == null)
                        return child;

                      return const Padding(
                        padding:
                            EdgeInsets.all(20),
                        child: Center(
                          child:
                              CircularProgressIndicator(),
                        ),
                      );
                    },

                    errorBuilder:
                        (context, error, stackTrace) {
                      return Container(
                        padding:
                            const EdgeInsets.all(12),
                        color:
                            Colors.grey.shade200,
                        child: const Text(
                          "❌ Image not available",
                          style: TextStyle(
                            color: Colors.red,
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),

            // PINNED
            if (msg["pinned"] == true)
              const Padding(
                padding:
                    EdgeInsets.only(top: 8),
                child: Row(
                  children: [
                    Icon(
                      Icons.push_pin,
                      size: 14,
                      color: Colors.orange,
                    ),
                    SizedBox(width: 4),
                    Text(
                      "Pinned",
                      style: TextStyle(
                        fontSize: 10,
                        color: Colors.orange,
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    ),
  );
}

  @override
Widget build(BuildContext context) {
  return Scaffold(
    
    drawer: Drawer(
  backgroundColor:
      isDarkMode ? Colors.black : Colors.white,
  child: Column(
    children: [

      DrawerHeader(
        child: Text(
          "VedaAI Chats 💬",
          style: TextStyle(
            color: isDarkMode ? Colors.white : Colors.black,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),

      // 🆕 NEW CHAT
      ListTile(
        leading: const Icon(Icons.add),
        title: const Text("New Chat"),
        onTap: newChat,
      ),

      const Divider(),
      
      // 💬 CHAT LIST
     Expanded(
  child: ListView.builder(
    itemCount: allChats.length,
    itemBuilder: (context, index) {
      return ListTile(
        leading: Icon(
          allChats[index]["favorite"] == true
              ? Icons.star
              : Icons.chat,
          color: allChats[index]["favorite"] == true
              ? Colors.orange
              : null,
        ),

        title: Text(
          allChats[index]["title"] ?? "New Chat",
          overflow: TextOverflow.ellipsis,
        ),

        selected: index == currentChatIndex,

        onTap: () {
          setState(() {
            currentChatIndex = index;

            messages = List<Map<String, dynamic>>.from(
              allChats[index]["messages"],
            );
          });

          Navigator.pop(context);
        },

        onLongPress: () {
          showDialog(
            context: context,
            builder: (context) {
              return AlertDialog(
                title: const Text("Chat Options"),
                content: const Text("Choose an action"),
                actions: [

                  // ⭐ Favorite
                  TextButton(
                    onPressed: () async {
                      setState(() {
                        allChats[index]["favorite"] =
                            !(allChats[index]["favorite"] ?? false);
                      });

                      await saveChat();

                      Navigator.pop(context);
                    },
                    child: Text(
                      allChats[index]["favorite"] == true
                          ? "Remove Star"
                          : "Add Star",
                    ),
                  ),

                  // Cancel
                  TextButton(
                    onPressed: () {
                      Navigator.pop(context);
                    },
                    child: const Text("Cancel"),
                  ),

                  // Delete Chat
                  TextButton(
                    onPressed: () async {
                      setState(() {
                        allChats.removeAt(index);

                        if (allChats.isEmpty) {
                          allChats.add({
                            "title": "New Chat",
                            "messages": [],
                            "favorite": false,
                          });

                          currentChatIndex = 0;
                          messages = [];
                        } else {
                          currentChatIndex = 0;

                          messages =
                              List<Map<String, dynamic>>.from(
                            allChats[0]["messages"],
                          );
                        }
                      });

                      await saveChat();

                      Navigator.pop(context);
                    },
                    child: const Text("Delete"),
                  ),
        ],
      );
    },
  );
},
            );
          },
        ),
      ),
    ],
  ),
),

          
    // 🔝 APP BAR
    appBar: AppBar(
  elevation: 0,
  backgroundColor: isDarkMode ? Colors.black : Colors.white,

  title: Row(
    children: [
      Container(
        height: 32,
        width: 32,
        decoration: BoxDecoration(
          color: Colors.blue,
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Icon(Icons.smart_toy,
            size: 18, color: Colors.white),
      ),
      const SizedBox(width: 10),
      const Text("VedaAI 💬"),
    ],
  ),

  actions: [

    // 🔍 SEARCH
    IconButton(
      icon: const Icon(Icons.search),
      onPressed: () {
        showSearch(
          context: context,
          delegate: ChatSearchDelegate(messages),
        );
      },
    ),

    // 🌙 DARK MODE
    IconButton(
      icon: Icon(
        isDarkMode ? Icons.light_mode : Icons.dark_mode,
      ),
      onPressed: () {
        setState(() {
          isDarkMode = !isDarkMode;
        });
      },
    ),

    // 📥 EXPORT (ONLY THIS EXTRA)
    IconButton(
      tooltip: "Export Chat",
      icon: const Icon(Icons.download),
      onPressed: exportChat,
    ),
  ],
),
    // 💬 BODY
    body: SafeArea(
      child: Column(
        children: [

          // CHAT LIST
         if (messages.any((m) => m["pinned"] == true))
  Container(
    padding: const EdgeInsets.all(8),
    color: Colors.yellow.shade100,
    child: Text("📌 Pinned Message"),
  ),
   Expanded(
  child: ListView.builder(
    controller: scrollController,
    padding: const EdgeInsets.only(bottom: 10),
    itemCount: messages.length,
    itemBuilder: (context, index) {
      return chatBubble(messages[index]);
    },
  ),
),


          // 🤖 TYPING INDICATOR
          if (isLoading)
  Center(
    child: LoadingAnimationWidget.threeArchedCircle(
      color: Colors.blue,
      size: 30,
    ),
  ),

          // 💬 INPUT BOX
          Padding(
            padding: const EdgeInsets.all(10),
            child: Row(
  children: [
    Expanded(
      child: TextField(
        controller: controller,
        decoration: const InputDecoration(
          hintText: "Ask anything...",
          border: OutlineInputBorder(),
        ),
      ),
    ),

    IconButton(
      icon: Icon(
        isListening
            ? Icons.mic
            : Icons.mic_none,
      ),
      onPressed: () {
        if (isListening) {
          stopListening();
        } else {
          startListening();
        }
      },
    ),

    IconButton(
      icon: const Icon(Icons.send),
      onPressed: sendMessage,
    ),
  ],
)
        
          ),

        ],
      ),
    ),
  );
} 
}

class ChatSearchDelegate extends SearchDelegate {
  final List<Map<String, dynamic>> messages;

  ChatSearchDelegate(this.messages);

  @override
  List<Widget>? buildActions(BuildContext context) {
    return [
      IconButton(
        icon: const Icon(Icons.clear),
        onPressed: () {
          query = "";
        },
      ),
    ];
  }

  @override
  Widget? buildLeading(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.arrow_back),
      onPressed: () {
        close(context, null);
      },
    );
  }

  @override
  Widget buildResults(BuildContext context) {
    final results = messages.where((msg) {
      return (msg["text"] ?? "")
          .toString()
          .toLowerCase()
          .contains(query.toLowerCase());
    }).toList();

    return ListView.builder(
      itemCount: results.length,
      itemBuilder: (context, index) {
        return ListTile(
          title: Text(results[index]["text"] ?? ""),
        );
      },
    );
  }

  @override
  Widget buildSuggestions(BuildContext context) {
    return buildResults(context);
  }
}