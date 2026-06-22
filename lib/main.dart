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
import 'package:flutter_markdown/flutter_markdown.dart';


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
bool showScrollButton = false;
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

  scrollController.addListener(() {

    if (scrollController.offset <
        scrollController.position.maxScrollExtent - 200) {

      setState(() {
        showScrollButton = true;
      });

    } else {

      setState(() {
        showScrollButton = false;
      });

    }

  });

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

Future<void> streamText(
  String fullText,
  int index,
) async {

  for (int i = 0; i < fullText.length; i += 5) {

    await Future.delayed(
      const Duration(milliseconds: 15),
    );

    if (!mounted) return;

    int end = i + 5;

    if (end > fullText.length) {
      end = fullText.length;
    }

    setState(() {

      allChats[currentChatIndex]["messages"][index]["text"] +=

          fullText.substring(i, end);

      messages = List<Map<String, dynamic>>.from(

        allChats[currentChatIndex]["messages"],

      );

    });

    scrollToBottom();

  }

  await saveChat();

}
void sendMessage() async {

  if (controller.text.trim().isEmpty) return;

  String userText = controller.text.trim();


  // First message title
  if ((allChats[currentChatIndex]["messages"] as List).isEmpty) {

    allChats[currentChatIndex]["title"] =

        userText.length > 25

            ? "${userText.substring(0, 25)}..."

            : userText;

  }


  setState(() {

    // USER MESSAGE
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


    String aiText = await getAIResponse(

      userText,

    );


    aiText = aiText.trim();


    String aiImage = "";

    
    setState(() {


      // EMPTY AI MESSAGE

      allChats[currentChatIndex]["messages"]

          .add({

        "role": "ai",

        "text": "",

        "image": aiImage,

        "pinned": false,

      });



      messages =

          List<Map<String, dynamic>>.from(

        allChats[currentChatIndex]

            ["messages"],

      );


      isLoading = false;

    });



    int index =

        allChats[currentChatIndex]

                    ["messages"]

                .length -

            1;



    await streamText(

      aiText,

      index,

    );



    scrollToBottom();


  } catch (e) {


    String offlineReply =

        getOfflineResponse(

      userText,

    );



    setState(() {


      allChats[currentChatIndex]

              ["messages"]

          .add({

        "role": "ai",

        "text": offlineReply,

        "pinned": false,

      });



      messages =

          List<Map<String, dynamic>>.from(

        allChats[currentChatIndex]

            ["messages"],

      );


      isLoading = false;

    });


    await saveChat();

    scrollToBottom();

  }

}
void scrollToBottom() {

  if (!scrollController.hasClients) return;

  scrollController.animateTo(

    scrollController.position.maxScrollExtent,

    duration: const Duration(milliseconds: 200),

    curve: Curves.easeOut,

  );

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

              ListTile(
                leading: const Icon(Icons.volume_up),
                title: const Text("Speak"),
                onTap: () {
                  speak(msg["text"] ?? "");
                  Navigator.pop(context);
                },
              ),

              ListTile(
                leading: const Icon(Icons.share),
                title: const Text("Share"),
                onTap: () {
                  Share.share(msg["text"] ?? "");
                  Navigator.pop(context);
                },
              ),

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

    child: Container(
      width: double.infinity,

      padding: const EdgeInsets.symmetric(
        horizontal: 18,
        vertical: 14,
      ),

      decoration: BoxDecoration(
        color: isUser
            ? (isDarkMode
                ? const Color(0xFF1E1E1E)
                : Colors.grey.shade100)
            : (isDarkMode
                ? const Color(0xFF2A2A2A)
                : Colors.white),
      ),

      child: Column(
        crossAxisAlignment:
            CrossAxisAlignment.start,

        children: [

          Text(
            isUser ? "You" : "VedaAI",

            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 15,

              color: isDarkMode
                  ? Colors.white
                  : Colors.black,
            ),
          ),

          const SizedBox(height: 8),

          MarkdownBody(
            data: msg["text"] ?? "",

            selectable: true,

            styleSheet: MarkdownStyleSheet(
              p: TextStyle(
                fontSize: 16,
                height: 1.7,

                color: isDarkMode
                    ? Colors.white
                    : Colors.black,
              ),

              h1: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),

              h2: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),

              h3: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),

          if (msg["image"] != null &&
              msg["image"].toString().isNotEmpty)
            Padding(
              padding:
                  const EdgeInsets.only(top: 12),

              child: ClipRRect(
                borderRadius:
                    BorderRadius.circular(12),

                child: Image.network(
                  msg["image"],

                  height: 220,

                  fit: BoxFit.cover,
                ),
              ),
            ),

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
                      fontSize: 11,

                      color: Colors.orange,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    ),
  );
}

  @override
Widget build(BuildContext context) {
  return Scaffold(

    floatingActionButton:
showScrollButton
?
FloatingActionButton(

mini: true,

onPressed: scrollToBottom,

child: Icon(Icons.arrow_downward),

)

: null,

   drawer: Drawer(
  backgroundColor: isDarkMode ? Colors.black : Colors.white,

  child: Column(
    children: [

      DrawerHeader(
        decoration: BoxDecoration(
          color: isDarkMode ? Colors.black : Colors.white,
        ),
        child: Align(
          alignment: Alignment.bottomLeft,
          child: Text(
            "VedaAI Chats 💬",
            style: TextStyle(
              color: isDarkMode ? Colors.white : Colors.black,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ),

      // 🆕 NEW CHAT
      ListTile(
  leading: Icon(
    Icons.add,
    color: isDarkMode
        ? Colors.white
        : Colors.black,
  ),

  title: Text(
    "New Chat",

    style: TextStyle(
      color: isDarkMode
          ? Colors.white
          : Colors.black,
    ),
  ),

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
      : (isDarkMode
          ? Colors.white
          : Colors.black),
),

title: Text(

  allChats[index]["title"] ?? "New Chat",

  overflow: TextOverflow.ellipsis,

  style: TextStyle(

    color: isDarkMode
        ? Colors.white
        : Colors.black,

  ),

),

      selected: index == currentChatIndex,

selectedTileColor: isDarkMode
    ? Colors.white12
    : Colors.black12,

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
                          allChats.insert(
  0,
  {
    "title": "New Chat",
    "messages": [],
    "favorite": false,
  },
);

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
  backgroundColor: Colors.white,

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
    crossAxisAlignment: CrossAxisAlignment.end,
    children: [

      Expanded(
        child: ConstrainedBox(
          constraints: const BoxConstraints(
            maxHeight: 300,
          ),

          child: TextField(
            controller: controller,

            minLines: 1,
            maxLines: null,

            keyboardType: TextInputType.multiline,

            decoration: InputDecoration(
              hintText: "Ask anything...",

              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(25),
              ),

              contentPadding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 12,
              ),
            ),
          ),
        ),
      ),

      const SizedBox(width: 5),

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
  ),
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