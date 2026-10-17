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
import 'package:image_picker/image_picker.dart';
import 'login_screen.dart';
import 'package:file_picker/file_picker.dart';
import 'splash_screen.dart';
import 'subscription_screen.dart';
import 'package:vedaai/notifications_screen.dart';
import 'package:intl/intl.dart';
import 'package:timezone/data/latest.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;
import 'dart:async';
import 'package:url_launcher/url_launcher.dart';
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  tzdata.initializeTimeZones();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
  debugShowCheckedModeBanner: false,

  themeMode: ThemeMode.system,

  theme: ThemeData.light(),

  darkTheme: ThemeData.dark(),

  home: const SplashScreen(),
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
  bool get isDarkMode =>
    Theme.of(context).brightness == Brightness.dark;

  bool isLoading = false;
  bool isListening = false;
  int copiedMessageIndex = -1;
bool showScrollButton = false;
bool isPremium = false;
bool isOwner = false;
String subscriptionType = "free";
  int currentChatIndex = 0;
bool showWelcomeScreen = true;

String getTimeGreeting() {
  final hour = DateTime.now().hour;

  if (hour >= 5 && hour < 12) {
    return "Good Morning";
  } else if (hour >= 12 && hour < 17) {
    return "Good Afternoon";
  } else if (hour >= 17 && hour < 21) {
    return "Good Evening";
  } else {
    return "Good Night";
  }
}
String userName = "User";

  List<Map<String, dynamic>> messages = [];

  List<Map<String, dynamic>> allChats = [
    {
      "title": "New Chat",
      "messages": []
    }
  ];
Timer? pauseTimer;

String remainingTime = "";
bool get isCurrentChatPaused {
  if (allChats.isEmpty) return false;

  if (currentChatIndex < 0 ||
      currentChatIndex >= allChats.length) {
    return false;
  }

  return allChats[currentChatIndex]["paused"] == true;
}

void startNewChat() {
  setState(() {
    messages = [];
    controller.clear();

    allChats.insert(0, {
      "id": DateTime.now().millisecondsSinceEpoch.toString(),
      "title": "New Chat",
      "messages": []
    });

    currentChatIndex = 0;
  });
}

Future<void> checkPremium() async {

  final prefs =
      await SharedPreferences.getInstance();

  final role =
      prefs.getString("role");

  // ?? OWNER ? always Premium
  if (role == "owner") {

    if (!mounted) return;

    setState(() {
      isOwner = true;
      isPremium = true;
      subscriptionType = "lifetime";
    });

    print(" OWNER ACCOUNT");
    print("Premium Status: true");
    print("Plan: lifetime");

    return;
  }

  // ?? / ?? NORMAL USER
  if (!mounted) return;

  setState(() {

    isPremium =
        prefs.getBool("isPremium") ?? false;

    subscriptionType =
        prefs.getString("subscriptionType") ?? "free";

  });

  print("Premium Status: $isPremium");
  print("Plan: $subscriptionType");

}

Future<void> loadUser() async {

  final prefs = await SharedPreferences.getInstance();

  setState(() {
    userName = prefs.getString("name") ?? "User";
  });

}

Future<bool> checkFreeMessageLimit() async {

  final prefs =
      await SharedPreferences.getInstance();


  String today =
      DateTime.now().toString().substring(0,10);


  String? savedDate =
      prefs.getString("lastMessageDate");


  int count =
      prefs.getInt("freeMessageCount") ?? 0;


  if(savedDate != today){

    count = 0;

    await prefs.setString(
      "lastMessageDate",
      today,
    );

    await prefs.setInt(
      "freeMessageCount",
      0,
    );

  }


  if(count >= 50){

    return false;

  }


  await prefs.setInt(
    "freeMessageCount",
    count + 1,
  );


  return true;

}
 
 Future<void> pickPdf() async {

  FilePickerResult? result =
      await FilePicker.platform.pickFiles(
    type: FileType.custom,
    allowedExtensions: ['pdf'],
  );

  if (result != null) {

    setState(() {

      selectedPdf =
          File(result.files.single.path!);

    });

    print("PDF Selected: ${selectedPdf!.path}");

  }

}

Future<bool> checkFreePdfLimit() async {

  final prefs =
      await SharedPreferences.getInstance();


  String today =
      DateTime.now()
          .toString()
          .substring(0,10);


  String? savedDate =
      prefs.getString("lastPdfDate");


  int pdfCount =
      prefs.getInt("freePdfCount") ?? 0;


  if(savedDate != today){

    pdfCount = 0;

    await prefs.setString(
      "lastPdfDate",
      today,
    );

    await prefs.setInt(
      "freePdfCount",
      0,
    );

  }


  if(pdfCount >= 5){

    return false;

  }


  await prefs.setInt(
    "freePdfCount",
    pdfCount + 1,
  );


  return true;

}

Future<void> uploadPdf() async {
  if (selectedPdf == null) return;

  if (!isPremium) {
    bool allowed = await checkFreePdfLimit();

    if (!allowed) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            "Daily PDF limit completed. Upgrade to Premium ??",
          ),
        ),
      );
      return;
    }
  }

  final pdfFile = selectedPdf!;

  setState(() {
    allChats[currentChatIndex]["messages"].add({
      "role": "user",
      "text": "?? PDF",
      "pdfFile": pdfFile.path,
      "pinned": false,
    });

    messages = List<Map<String, dynamic>>.from(
      allChats[currentChatIndex]["messages"],
    );

    selectedPdf = null;
    isLoading = true;
  });

  try {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString("token");

    if (token == null) {
      throw Exception("Please login again.");
    }

    var request = http.MultipartRequest(
      "POST",
      Uri.parse("https://vedaai-backend-25-2pl4.onrender.com/pdf"),
    );

    request.headers["Authorization"] = "Bearer $token";

    request.files.add(
      await http.MultipartFile.fromPath(
        "file",
        pdfFile.path,
      ),
    );

    final response = await request.send();
    final responseBody = await response.stream.bytesToString();

    print("PDF STATUS: ${response.statusCode}");
    print("PDF RESPONSE: $responseBody");

    if (response.statusCode != 200) {
      throw Exception(responseBody);
    }

    final data = jsonDecode(responseBody);

    final reply =
        data["reply"]?.toString() ??
        "No response generated.";

    setState(() {
      allChats[currentChatIndex]["messages"].add({
        "role": "ai",
        "text": reply,
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
    print("PDF UPLOAD ERROR: $e");

    setState(() {
      allChats[currentChatIndex]["messages"].add({
        "role": "ai",
        "text": "PDF upload failed.\n\n$e",
        "pinned": false,
      });

      messages = List<Map<String, dynamic>>.from(
        allChats[currentChatIndex]["messages"],
      );

      isLoading = false;
    });

    scrollToBottom();
  }
} 

Future<bool> checkFreeImageLimit() async {

  final prefs =
      await SharedPreferences.getInstance();


  String today =
      DateTime.now()
          .toString()
          .substring(0, 10);


  String? savedDate =
      prefs.getString("lastImageDate");


  int imageCount =
      prefs.getInt("freeImageCount") ?? 0;


  if (savedDate != today) {

    imageCount = 0;

    await prefs.setString(
      "lastImageDate",
      today,
    );

    await prefs.setInt(
      "freeImageCount",
      0,
    );

  }


  if (imageCount >= 5) {

    return false;

  }


  await prefs.setInt(
    "freeImageCount",
    imageCount + 1,
  );


  return true;

}
  // 3. API FUNCTION (OK PLACE)
  

  final stt.SpeechToText speech = stt.SpeechToText();
  final FlutterTts flutterTts = FlutterTts();
  final ImagePicker picker = ImagePicker();

 File? selectedImage;
 File? selectedPdf;

  @override
void dispose() {

  pauseTimer?.cancel();

  controller.dispose();

  scrollController.dispose();

  flutterTts.stop();

  super.dispose();

}

@override
void initState() {
  super.initState();

  checkOwner();
  checkPremium();
  loadUser();

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
Future checkOwner() async {
  final prefs = await SharedPreferences.getInstance();

  final role = prefs.getString("role");
  final premium = prefs.getBool("isPremium") ?? false;
  final plan = prefs.getString("subscriptionType");

  print("==============");
  print("ROLE = $role");
  print("PREMIUM = $premium");
  print("PLAN = $plan");
  print("==============");

  if (!mounted) return;

  setState(() {
    isOwner = role == "owner";

    if (isOwner) {
      isPremium = true;
      subscriptionType = "lifetime";
    }
  });
}

Future<void> pickImage() async {

  final XFile? image = await picker.pickImage(
    source: ImageSource.gallery,
  );

  if (image != null) {

    setState(() {
      selectedImage = File(image.path);
    });

  }

}
Future<void> uploadImage() async {
  if (selectedImage == null) {
    return;
  }

  final String userText = controller.text.trim();

  // Free user image limit
  if (!isPremium && !isOwner) {
    final bool allowed = await checkFreeImageLimit();

    if (!allowed) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            "Daily image limit completed. Upgrade to Premium.",
          ),
        ),
      );

      return;
    }
  }

  // Keep selected image
  final File imageFile = selectedImage!;

  // User message text
  final String displayText =
      userText.isEmpty ? "Image" : userText;

  // ==================================================
  // ADD USER IMAGE + QUESTION TO CHAT
  // ==================================================

  setState(() {
    allChats[currentChatIndex]["messages"].add({
      "role": "user",
      "text": displayText,
      "image": imageFile.path,
      "pinned": false,
    });

    messages = List<Map<String, dynamic>>.from(
      allChats[currentChatIndex]["messages"],
    );

    // IMPORTANT:
    // Clear both image and typed text together
    selectedImage = null;
    controller.clear();

    isLoading = true;
  });

  await saveChat();
  scrollToBottom();

  try {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString("token");

    if (token == null) {
      throw Exception("Please login again.");
    }

    // ==================================================
    // IMAGE REQUEST
    // ==================================================

    final request = http.MultipartRequest(
      "POST",
      Uri.parse(
        "https://vedaai-backend-25-2pl4.onrender.com/image",
      ),
    );

    request.headers["Authorization"] =
        "Bearer $token";

    // IMPORTANT:
    // Send user's actual question together with image
    request.fields["prompt"] = userText;

    request.files.add(
      await http.MultipartFile.fromPath(
        "image",
        imageFile.path,
      ),
    );

    print("===== IMAGE REQUEST =====");
    print("PROMPT: $userText");
    print("IMAGE: ${imageFile.path}");
    print("=========================");

    final response = await request.send();

    final responseBody =
        await response.stream.bytesToString();

    print("IMAGE STATUS: ${response.statusCode}");
    print("IMAGE RESPONSE: $responseBody");

    if (response.statusCode != 200) {
      throw Exception(responseBody);
    }

    final data = jsonDecode(responseBody);

    if (data["success"] == false) {
      throw Exception(
        data["message"] ??
            "Image request failed.",
      );
    }

    final String reply =
        data["reply"]?.toString().trim() ??
            "No response generated.";

    // ==================================================
    // AI RESPONSE
    // ==================================================

    if (!mounted) return;

    setState(() {
      allChats[currentChatIndex]["messages"].add({
        "role": "ai",
        "text": reply.isEmpty
            ? "No response generated."
            : reply,
        "pinned": false,
        "thinking": false,
      });

      messages =
          List<Map<String, dynamic>>.from(
        allChats[currentChatIndex]["messages"],
      );

      isLoading = false;
    });

    await saveChat();
    scrollToBottom();

  } catch (e) {
    print("IMAGE UPLOAD ERROR: $e");

    if (!mounted) return;

    setState(() {
      allChats[currentChatIndex]["messages"].add({
        "role": "ai",
        "text":
            "Image upload failed.\n\n$e",
        "pinned": false,
        "thinking": false,
      });

      messages =
          List<Map<String, dynamic>>.from(
        allChats[currentChatIndex]["messages"],
      );

      isLoading = false;
    });

    await saveChat();
    scrollToBottom();
  }
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

  if (RegExp(r'[?-?]').hasMatch(text)) {
    await flutterTts.setLanguage("hi-IN");
  } else {
    await flutterTts.setLanguage("en-US");
  }

  await flutterTts.speak(text);
}  

Future loadChat() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString("token");

    if (token == null) return;

    final response = await http.get(
      Uri.parse(
        "https://vedaai-backend-25-2pl4.onrender.com/load-chats",
      ),
      headers: {
        "Authorization": "Bearer $token",
      },
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);

      final chats = data["chats"] ?? [];

      List<Map<String, dynamic>> loadedChats = [];

      if (chats is List) {
        for (final rawChat in chats) {
          if (rawChat is! Map) continue;

          final chat =
              Map<String, dynamic>.from(rawChat);

          // ==============================
          // ENSURE CHAT ID
          // ==============================

          final existingId =
              chat["id"] ??
              chat["_id"] ??
              chat["chatId"];

          chat["id"] =
              existingId?.toString().isNotEmpty == true
                  ? existingId.toString()
                  : DateTime.now()
                      .millisecondsSinceEpoch
                      .toString();

          // ==============================
          // DEFAULT VALUES
          // ==============================

          chat["title"] ??= "New Chat";

          chat["messages"] ??=
              <Map<String, dynamic>>[];

          chat["favorite"] ??= false;
          chat["pinned"] ??= false;
          chat["messageCount"] ??= 0;

          chat["paused"] ??= false;

          chat["resetTime"] ??= null;

          loadedChats.add(chat);
        }
      }

      // ==============================
      // IF NO CHATS
      // ==============================

      if (loadedChats.isEmpty) {
        loadedChats.add({
          "id": DateTime.now()
              .millisecondsSinceEpoch
              .toString(),
          "title": "New Chat",
          "messages": <Map<String, dynamic>>[],
          "favorite": false,
          "messageCount": 0,
          "paused": false,
          "resetTime": null,
        });
      }

     setState(() {
  allChats = loadedChats;

  currentChatIndex = -1;

  messages = [];

  controller.clear();
});
      // ==============================
      // DEBUG
      // ==============================

      print("========== CHAT IDS ==========");

      for (final chat in allChats) {
        print(
          "CHAT ID: ${chat["id"]}",
        );
      }

      print("==============================");

      await saveChat();

      startPauseTimer();
    }
  } catch (e) {
    print("LOAD CHAT ERROR: $e");
  }
}

Future<void> logout() async {

  final prefs = await SharedPreferences.getInstance();

  await prefs.remove("token");
  await prefs.remove("userId");
  await prefs.remove("name");
  await prefs.remove("role");
  await prefs.remove("isPremium");
  await prefs.remove("subscriptionType");
  await prefs.remove("subscriptionExpiry");

  if (!mounted) return;

  Navigator.pushAndRemoveUntil(

    context,

    MaterialPageRoute(
      builder: (_) => const LoginScreen(),
    ),

    (route) => false,

  );

}
Future saveChat() async {
  // Chat messages are now saved by the /chat API.
  // No separate /save-chats API is required.
}
Future<void> renameChat(int index, String newTitle) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString("token");

    if (token == null) {
      throw Exception("Please login again.");
    }

    final chatId = allChats[index]["id"];

    if (chatId == null) {
      throw Exception("Chat ID not found.");
    }

    final response = await http.put(
      Uri.parse("https://vedaai-backend-25-2pl4.onrender.com/rename-chat"),
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer $token",
      },
      body: jsonEncode({
        "chatId": chatId,
        "title": newTitle.trim(),
      }),
    );

    print("RENAME STATUS: ${response.statusCode}");
    print("RENAME RESPONSE: ${response.body}");

    if (response.statusCode != 200) {
      throw Exception(
        "Rename failed: ${response.body}",
      );
    }

    setState(() {
      allChats[index]["title"] = newTitle.trim();
    });

    print("? CHAT RENAMED SUCCESSFULLY");

  } catch (e) {
    print("? RENAME CHAT ERROR: $e");

    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text("Rename failed: $e"),
      ),
    );
  }
}

Future<void> newChat() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString("token");

    if (token == null) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Please login again."),
        ),
      );
      return;
    }

    final response = await http.post(
      Uri.parse(
        "https://vedaai-backend-25-2pl4.onrender.com/create-chat",
      ),
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer $token",
      },
    );

    if (response.statusCode != 201) {
      throw Exception(
        "Create chat failed: ${response.statusCode}",
      );
    }

    final data = jsonDecode(response.body);
    final chat = Map<String, dynamic>.from(data["chat"]);

    chat["messages"] = <Map<String, dynamic>>[];
    chat["favorite"] ??= false;
    chat["pinned"] ??= false;
    chat["messageCount"] ??= 0;
    chat["paused"] ??= false;
    chat["resetTime"] ??= null;

    if (!mounted) return;

    setState(() {
      allChats.insert(0, chat);
      currentChatIndex = 0;
      messages = [];
      showWelcomeScreen = false;
      controller.clear();
    });

    scrollToBottom();
  } catch (e) {
    debugPrint("NEW CHAT ERROR: $e");

    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text("Unable to create chat. Please try again."),
      ),
    );
  }
}



Future<void> clearChat() async {
  setState(() {
    allChats = [
      {
  "id": DateTime.now().millisecondsSinceEpoch.toString(),
  "title": "New Chat",
  "messages": <Map<String, dynamic>>[],
  "favorite": false,
  "pinned": false,
  "messageCount": 0,
  "paused": false,
  "resetTime": null,
}
    ];

    currentChatIndex = 0;
    messages = [];
    controller.clear();
  });

  await saveChat();
}
 
String getOfflineResponse(String message) {
  String msg = message.toLowerCase().trim();

  if (msg.contains("hello") || msg.contains("hi")) {
    return "Hello ??\n\nI am VedaAI running in Offline Mode.";
  }

  if (msg.contains("how are you")) {
    return "I'm doing well ??\n\nHow can I help you today?";
  }

  if (msg.contains("your name")) {
    return "My name is VedaAI ??";
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
 ?
Training
 ?
Model
 ?
Prediction
""";
  }

  if (msg.contains("what is ai")) {
    return """
Artificial Intelligence (AI)

AI is the ability of computers to perform tasks that normally require human intelligence.

Examples:
? Chatbots
? Face Recognition
? Self Driving Cars
? Voice Assistants
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

     final prefs = await SharedPreferences.getInstance();

    final token = prefs.getString("token");
    if(token == null){
  return "Please login again";
}

    final url = Uri.parse(
      "https://vedaai-backend-25-2pl4.onrender.com/chat"
    );

    final res = await http.post(
  url,

  headers: {

    "Content-Type": "application/json",

    "Authorization": "Bearer $token",

  },

  body: jsonEncode({

    "message": text,

    "history": messages
    .map((msg) => {
          "role": msg["role"],
          "text": msg["text"],
        })
    .toList()
    .take(15)
    .toList(),

  }),

);

    print("STATUS: ${res.statusCode}");
    print("BODY: ${res.body}");

    if (res.statusCode == 200) {

  final data = jsonDecode(res.body);


  // FREE LIMIT MESSAGE FROM BACKEND
  if (data["success"] == false) {

    return data["message"] ??
        "Daily limit completed. Upgrade to Premium ??";

  }


  return data["reply"] ?? "No response";

}else {
      return "Server Error: ${res.statusCode}";
    }
  } catch (e) {
    print("ERROR: $e");
    return "ERROR: $e";
  }
}

Future<void> streamAIResponse(
  String text,
  int index,
  List<Map<String, dynamic>> history,
) async {
  http.Client? client;

  try {
    // ==================================================
    // GET TOKEN
    // ==================================================

    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString("token");

    if (token == null) {
      if (!mounted) return;

      setState(() {
        allChats[currentChatIndex]["messages"][index]["thinking"] =
            false;

        allChats[currentChatIndex]["messages"][index]["text"] =
            "Please login again.";

        messages = List<Map<String, dynamic>>.from(
          allChats[currentChatIndex]["messages"],
        );
      });

      return;
    }

    // ==================================================
    // HTTP CLIENT
    // ==================================================

    client = http.Client();

    final request = http.Request(
      "POST",
      Uri.parse(
        "https://vedaai-backend-25-2pl4.onrender.com/chat",
      ),
    );

    request.headers.addAll({
      "Authorization": "Bearer $token",
      "Content-Type": "application/json",
    });

    request.body = jsonEncode({
      "message": text,
      "history": history.take(15).toList(),
      "chatId": allChats[currentChatIndex]["id"],
    });

    print("===== CURRENT CHAT =====");
    print(allChats[currentChatIndex]);
    print("========================");

    // ==================================================
    // SEND REQUEST
    // ==================================================

    final response = await client.send(request);

    // ==================================================
    // SERVER ERROR
    // ==================================================

    if (response.statusCode != 200) {
      final body = await response.stream.bytesToString();

      if (!mounted) {
        client.close();
        return;
      }

      setState(() {
        allChats[currentChatIndex]["messages"][index]["thinking"] =
            false;

        allChats[currentChatIndex]["messages"][index]["text"] =
            body.isEmpty
                ? "Server Error: ${response.statusCode}"
                : body;

        messages = List<Map<String, dynamic>>.from(
          allChats[currentChatIndex]["messages"],
        );
      });

      await saveChat();

      client.close();
      return;
    }

   // ==================================================
// ROBUST STREAM PARSER
// ==================================================

String buffer = "";
String aiText = "";

bool receivingResponse = false;
bool receivingSources = false;
bool receivingFollowUps = false;
bool receivingProduct = false;
bool receivingImages = false;

String sourceBuffer = "";
String followUpBuffer = "";
String productBuffer = "";
String imageBuffer = "";

List<Map<String, dynamic>> receivedSources = [];
List<String> receivedFollowUps = [];

Map<String, dynamic>? receivedProduct;
List<Map<String, dynamic>> receivedImages = [];

// ==================================================
// MARKERS
// ==================================================

const sourcesStart = "<<<VEDAAI_SOURCES_START>>>";
const sourcesEnd = "<<<VEDAAI_SOURCES_END>>>";

const responseStart = "<<<VEDAAI_RESPONSE_START>>>";
const responseEnd = "<<<VEDAAI_RESPONSE_END>>>";

const followUpsStart = "<<<VEDAAI_FOLLOWUPS_START>>>";
const followUpsEnd = "<<<VEDAAI_FOLLOWUPS_END>>>";

const productStart = "<<<VEDAAI_PRODUCT_START>>>";
const productEnd = "<<<VEDAAI_PRODUCT_END>>>";
const imagesStart = "<<<VEDAAI_IMAGES_START>>>";
const imagesEnd = "<<<VEDAAI_IMAGES_END>>>";

// ==================================================
// ALL MARKERS
// ==================================================

final allMarkers = [
  sourcesStart,
  sourcesEnd,
  responseStart,
  responseEnd,
  followUpsStart,
  followUpsEnd,
  productStart,
  productEnd,
  imagesStart,
  imagesEnd,
];

// Keep enough characters at the end of a chunk
// because a marker can be split between chunks.
int safeKeepLength = allMarkers
    .map((m) => m.length)
    .reduce((a, b) => a > b ? a : b);

// ==================================================
// PROCESS NORMAL RESPONSE TEXT
// ==================================================

void updateAIText() {

  if (!mounted) return;

  setState(() {

    allChats[currentChatIndex]
            ["messages"][index]["text"] =
        aiText;

    allChats[currentChatIndex]
            ["messages"][index]["thinking"] =
        false;

    messages =
        List<Map<String, dynamic>>.from(
      allChats[currentChatIndex]["messages"],
    );
  });

  scrollToBottom();
}

// ==================================================
// READ STREAM
// ==================================================

await for (
  final chunk in response.stream.transform(utf8.decoder)
) {

  if (!mounted) {
    client.close();
    return;
  }

  print("CHUNK: $chunk");

  buffer += chunk;

  bool processed = true;

  while (processed) {

    processed = false;

    // ==================================================
    // IMAGES JSON PARSER ADDED
    // ==================================================

    if (receivingImages) {
      final end = buffer.indexOf(imagesEnd);

      if (end != -1) {
        imageBuffer += buffer.substring(0, end);
        buffer = buffer.substring(end + imagesEnd.length);

        try {
          final decoded = jsonDecode(imageBuffer.trim());

          if (decoded is List) {
            receivedImages = decoded
                .whereType<Map>()
                .map((e) => Map<String, dynamic>.from(e))
                .where((e) =>
                    e["url"] is String &&
                    (e["url"] as String).startsWith("http"))
                .toList();

            if (mounted) {
              setState(() {
                allChats[currentChatIndex]["messages"][index]["images"] =
                    receivedImages;

                messages = List<Map<String, dynamic>>.from(
                  allChats[currentChatIndex]["messages"],
                );
              });
            }

            print("VEDAAI IMAGES RECEIVED: ${receivedImages.length}");
          }
        } catch (e) {
          print("VEDAAI IMAGES PARSE ERROR: $e");
        }

        imageBuffer = "";
        receivingImages = false;
        processed = true;
        continue;
      }

      break;
    }
    // ==================================================
    // SOURCES
    // ==================================================

    if (receivingSources) {

      final end = buffer.indexOf(sourcesEnd);

      if (end != -1) {

        sourceBuffer +=
            buffer.substring(0, end);

        buffer = buffer.substring(
          end + sourcesEnd.length,
        );

        try {

          final decoded =
              jsonDecode(sourceBuffer.trim());

          if (decoded is List) {

            receivedSources =
                decoded
                    .whereType<Map>()
                    .map(
                      (e) => Map<String, dynamic>.from(e),
                    )
                    .toList();

            print(
              "?? RECEIVED SOURCES: $receivedSources",
            );

            if (mounted) {

              setState(() {

                allChats[currentChatIndex]
                        ["messages"][index]["sources"] =
                    receivedSources;

                messages =
                    List<Map<String, dynamic>>.from(
                  allChats[currentChatIndex]
                      ["messages"],
                );
              });
            }
          }

        } catch (e) {

          print(
            "? SOURCE JSON ERROR: $e",
          );

          print(
            "SOURCE BUFFER: $sourceBuffer",
          );
        }

        sourceBuffer = "";
        receivingSources = false;

        processed = true;
        continue;
      }

      // END marker not complete yet.
      // Keep buffer untouched until next chunk.
      break;
    }

    // ==================================================
    // FOLLOW UPS
    // ==================================================

    if (receivingFollowUps) {

      final end =
          buffer.indexOf(followUpsEnd);

      if (end != -1) {

        followUpBuffer +=
            buffer.substring(0, end);

        buffer = buffer.substring(
          end + followUpsEnd.length,
        );

        try {

          final decoded =
              jsonDecode(
            followUpBuffer.trim(),
          );

          if (decoded is List) {

            receivedFollowUps =
                decoded
                    .map(
                      (e) => e.toString(),
                    )
                    .where(
                      (e) => e.trim().isNotEmpty,
                    )
                    .toList();

            print(
              "?? RECEIVED FOLLOW-UPS: "
              "$receivedFollowUps",
            );

            if (mounted) {

              setState(() {

                allChats[currentChatIndex]
                        ["messages"][index]
                    ["followUps"] =
                    receivedFollowUps;

                messages =
                    List<Map<String, dynamic>>.from(
                  allChats[currentChatIndex]
                      ["messages"],
                );
              });
            }
          }

        } catch (e) {

          print(
            "? FOLLOW-UP JSON ERROR: $e",
          );

          print(
            "FOLLOW-UP BUFFER: "
            "$followUpBuffer",
          );
        }

        followUpBuffer = "";
        receivingFollowUps = false;

        processed = true;
        continue;
      }

      break;
    }

    // ==================================================
    // PRODUCT
    // ==================================================

    if (receivingProduct) {

      final end =
          buffer.indexOf(productEnd);

      if (end != -1) {

        productBuffer +=
            buffer.substring(0, end);

        buffer = buffer.substring(
          end + productEnd.length,
        );

        try {

          final decoded =
              jsonDecode(
            productBuffer.trim(),
          );

          if (decoded is Map) {

            receivedProduct =
                Map<String, dynamic>.from(
              decoded,
            );

            print(
              "??? RECEIVED PRODUCT:"
              " $receivedProduct",
            );

            if (mounted) {

              setState(() {

                allChats[currentChatIndex]
                        ["messages"][index]
                    ["product"] =
                    receivedProduct;

                messages =
                    List<Map<String, dynamic>>.from(
                  allChats[currentChatIndex]
                      ["messages"],
                );
              });
            }
          }

        } catch (e) {

          print(
            "? PRODUCT JSON ERROR: $e",
          );

          print(
            "PRODUCT BUFFER: "
            "$productBuffer",
          );
        }

        productBuffer = "";
        receivingProduct = false;

        processed = true;
        continue;
      }

      break;
    }

    // ==================================================
    // RESPONSE
    // ==================================================

    if (receivingResponse) {

      final end =
          buffer.indexOf(responseEnd);

      if (end != -1) {

        final text =
            buffer.substring(0, end);

        if (text.isNotEmpty) {
          aiText += text;
        }

        buffer = buffer.substring(
          end + responseEnd.length,
        );

        receivingResponse = false;

        print("?? RESPONSE END");

        updateAIText();

        processed = true;
        continue;
      }

      // ------------------------------------------------
      // IMPORTANT:
      // Don't send the whole buffer immediately.
      //
      // Keep last characters because they may be the
      // beginning of RESPONSE_END.
      // ------------------------------------------------

      if (buffer.length > safeKeepLength) {

        final safeText =
            buffer.substring(
          0,
          buffer.length - safeKeepLength,
        );

        aiText += safeText;

        buffer =
            buffer.substring(
          buffer.length - safeKeepLength,
        );

        updateAIText();
      }

      break;
    }

    // ==================================================
    // FIND NEXT MARKER
    // ==================================================

    int nextIndex = -1;
    String? nextMarker;

    for (final marker in allMarkers) {

      final i = buffer.indexOf(marker);

      if (i != -1 &&
          (nextIndex == -1 ||
              i < nextIndex)) {

        nextIndex = i;
        nextMarker = marker;
      }
    }

    // ==================================================
    // NO COMPLETE MARKER
    // ==================================================

    if (nextIndex == -1) {

      // Keep possible partial marker at end.
      if (buffer.length > safeKeepLength) {

        final safeText =
            buffer.substring(
          0,
          buffer.length - safeKeepLength,
        );

        // Only normal text should reach here.
        if (receivingResponse) {
          aiText += safeText;
          updateAIText();
        }

        buffer =
            buffer.substring(
          buffer.length - safeKeepLength,
        );
      }

      break;
    }

    // ==================================================
    // TEXT BEFORE MARKER
    // ==================================================

    if (nextIndex > 0) {

      final before =
          buffer.substring(
        0,
        nextIndex,
      );

      if (receivingResponse) {

        aiText += before;
        updateAIText();
      }

      buffer =
          buffer.substring(nextIndex);
    }

    // ==================================================
    // RESPONSE START
    // ==================================================

    if (buffer.startsWith(responseStart)) {

      buffer =
          buffer.substring(
        responseStart.length,
      );

      receivingResponse = true;

      print("?? RESPONSE START");

      if (mounted) {

        setState(() {

          allChats[currentChatIndex]
                  ["messages"][index]
              ["thinking"] = false;

          messages =
              List<Map<String, dynamic>>.from(
            allChats[currentChatIndex]
                ["messages"],
          );
        });
      }

      processed = true;
      continue;
    }

    // ==================================================
    // RESPONSE END
    // ==================================================

    if (buffer.startsWith(responseEnd)) {

      buffer =
          buffer.substring(
        responseEnd.length,
      );

      receivingResponse = false;

      print("?? RESPONSE END");

      updateAIText();

      processed = true;
      continue;
    }

    // ==================================================
// SOURCES START
    // ==================================================

    if (buffer.startsWith(imagesStart)) {
      buffer = buffer.substring(imagesStart.length);
      receivingImages = true;
      processed = true;
      continue;
    }
    if (buffer.startsWith(sourcesStart)) {

      buffer =
          buffer.substring(
        sourcesStart.length,
      );

      receivingSources = true;

      print("?? SOURCES START");

      processed = true;
      continue;
    }

    // ==================================================
    // FOLLOW UPS START
    // ==================================================

    if (buffer.startsWith(followUpsStart)) {

      buffer =
          buffer.substring(
        followUpsStart.length,
      );

      receivingFollowUps = true;

      print("?? FOLLOW-UPS START");

      processed = true;
      continue;
    }

    // ==================================================
    // PRODUCT START
    // ==================================================

    if (buffer.startsWith(productStart)) {

      buffer =
          buffer.substring(
        productStart.length,
      );

      receivingProduct = true;

      print("??? PRODUCT START");

      processed = true;
      continue;
    }

    // ==================================================
    // SAFETY
    // ==================================================

    // If something unexpected happens,
    // don't put protocol markers into AI text.

    if (nextMarker != null &&
        buffer.startsWith(nextMarker)) {

      buffer =
          buffer.substring(
        nextMarker.length,
      );

      processed = true;
    }
  }
}
// ==================================================
// FINAL STREAM CLEANUP
// ==================================================

if (buffer.isNotEmpty) {

  if (receivingResponse) {

    // Only actual answer text.
    aiText += buffer;

  } else if (receivingSources) {

    sourceBuffer += buffer;

  } else if (receivingFollowUps) {

    followUpBuffer += buffer;

  } else if (receivingProduct) {

    productBuffer += buffer;

  } else if (receivingImages) {

    imageBuffer += buffer;
  }

  buffer = "";
}

aiText = aiText.trim();

print("=================================");
print("STREAM FINISHED");
print("AI TEXT:");
print(aiText);
print("SOURCES:");
print(receivedSources);
print("PRODUCT:");
print(receivedProduct);
print("FOLLOW-UPS:");
print(receivedFollowUps);
print("=================================");

    
     // ==================================================
// FINAL FOLLOW-UP CLEANUP
// ==================================================

const followUpStartMarker =
    "<<<VEDAAI_FOLLOWUPS_START>>>";

const followUpEndMarker =
    "<<<VEDAAI_FOLLOWUPS_END>>>";

// ?? Follow-up marker ????? aiText ????? ??? ????
final followUpStartIndex =
    aiText.indexOf(followUpStartMarker);

if (followUpStartIndex != -1) {

  final followUpEndIndex =
      aiText.indexOf(
    followUpEndMarker,
    followUpStartIndex +
        followUpStartMarker.length,
  );

  if (followUpEndIndex != -1) {

    // Follow-up ????? section ????? ????
    aiText =
        aiText.substring(0, followUpStartIndex) +
        aiText.substring(
          followUpEndIndex +
              followUpEndMarker.length,
        );

  } else {

    // START ?????? ?? END ???? ????
    // ???????? ?????????? ??? answer ????? ???? ???
    aiText =
        aiText.substring(
      0,
      followUpStartIndex,
    );
  }
}

// ????? extra spaces ????
aiText = aiText.trim();

   // ==================================================
// FINAL MESSAGE SAVE
// ==================================================

if (mounted) {
  setState(() {

    final currentMessage =
        allChats[currentChatIndex]["messages"][index];

    // AI RESPONSE
    currentMessage["text"] =
        aiText;

    // THINKING OFF
    currentMessage["thinking"] =
        false;

    // SOURCES
    currentMessage["sources"] =
        receivedSources;

    // PRODUCT
    if (receivedProduct != null) {

      currentMessage["product"] =
          receivedProduct;

    } else {

      currentMessage.remove("product");
    }

    // FOLLOW-UPS
    currentMessage["followUps"] =
        receivedFollowUps;

    // REFRESH MESSAGES
    messages =
        List<Map<String, dynamic>>.from(
      allChats[currentChatIndex]["messages"],
    );
  });
}
   // ==================================================
// SAVE CHAT
// ==================================================

try {
  await saveChat();

  print("? CHAT SAVED SUCCESSFULLY");

} catch (e) {

  print("?? SAVE CHAT ERROR: $e");

  // IMPORTANT:
  // Chat save fail ???? ??? AI answer
  // "Something went wrong" ????? ???? ???.
}

print("===== ALL CHATS =====");
print(allChats[currentChatIndex]["messages"]);
print("=====================");

client.close();
 } catch (e, stackTrace) {

  print("??? STREAM ERROR ???");
  print("ERROR: $e");
  print("STACK TRACE:");
  print(stackTrace);
  print("??? END STREAM ERROR ???");

  // Close client safely
  client?.close();

  if (!mounted) return;

  setState(() {

    final currentMessage =
        allChats[currentChatIndex]["messages"][index];

    // Thinking ???
    currentMessage["thinking"] =
        false;

    // Error message
    currentMessage["text"] =
        "Something went wrong. Please try again.";

    // Error ???????? ???? data ????? ???
    currentMessage["sources"] =
        [];

    currentMessage["followUps"] =
        [];

    currentMessage.remove("product");

    // Refresh messages
    messages =
        List<Map<String, dynamic>>.from(
      allChats[currentChatIndex]["messages"],
    );
  });
}
}

Future<void> streamText(
  String fullText,
  int index,
) async {

  for (int i = 0; i < fullText.length; i += 10) {

    await Future.delayed(
      const Duration(milliseconds: 5),
    );

    if (!mounted) return;

    int end = i + 10;

    if (end > fullText.length) {
      end = fullText.length;
    }

    setState(() {

      allChats[currentChatIndex]["messages"][index]["text"] +=
          fullText.substring(i, end);

      messages =
          List<Map<String, dynamic>>.from(
            allChats[currentChatIndex]["messages"],
          );

    });

    scrollToBottom();

  }

  await saveChat();

}

void startPauseTimer() {
  pauseTimer?.cancel();

  pauseTimer = Timer.periodic(
    const Duration(seconds: 1),
    (timer) async {
      if (!mounted) return;

      final chat = allChats[currentChatIndex];

      if (chat["paused"] != true ||
          chat["resetTime"] == null) {
        return;
      }

      final resetTime =
          DateTime.parse(chat["resetTime"]);

      final difference =
          resetTime.difference(DateTime.now());

      // ? TIMER COMPLETE
      if (difference.inSeconds <= 0) {
        setState(() {
          chat["paused"] = false;
          chat["messageCount"] = 0;
          chat["resetTime"] = null;

          remainingTime = "";
        });

        await saveChat();

        timer.cancel();

        return;
      }

      final hours = difference.inHours;
      final minutes =
          difference.inMinutes % 60;
      final seconds =
          difference.inSeconds % 60;

      setState(() {
        remainingTime =
            "${hours.toString().padLeft(2, '0')}:"
            "${minutes.toString().padLeft(2, '0')}:"
            "${seconds.toString().padLeft(2, '0')}";
      });
    },
  );
}
void sendMessage() async {

  // Prevent sending another message while AI is replying
  if (isLoading) return;

  final chat = allChats[currentChatIndex];

if (chat["paused"] == true) {

  final resetTime = chat["resetTime"];

  if (resetTime != null &&
      DateTime.now().isBefore(DateTime.parse(resetTime))) {

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content:Text(
  "You've used all messages for this chat.\n\n"
  "Try again at ${allChats[currentChatIndex]["resetTime"] == null
      ? "--"
      : DateFormat("h:mm a").format(
          DateTime.parse(
            allChats[currentChatIndex]["resetTime"],
          ),
        )}",
),
      ),
    );

    return;
  }

  // Auto reset after timer
  chat["paused"] = false;
  chat["messageCount"] = 0;
  chat["resetTime"] = null;

allChats[currentChatIndex]["updatedAt"] =
    DateTime.now().millisecondsSinceEpoch;
  await saveChat();
}

  if (controller.text.trim().isEmpty) return;

  String userText = controller.text.trim();

   if (!isPremium && !isOwner) {

    bool allowed =
        await checkFreeMessageLimit();


    if (!allowed) {

      ScaffoldMessenger.of(context)
          .showSnackBar(
        const SnackBar(
          content: Text(
            "Daily free limit completed. Upgrade to Premium ??",
          ),
        ),
      );

      return;
    }

  }
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

final historyForAI = List<Map<String, dynamic>>.from(
  allChats[currentChatIndex]["messages"],
);

try {
  

    String aiImage = "";

    
    setState(() {


      // EMPTY AI MESSAGE
     allChats[currentChatIndex]["messages"].add({
  "role": "ai",
  "text": "",
  "thinking": true,
  "image": aiImage,
  "pinned": false,
  "followUps": [],
});

      messages =

          List<Map<String, dynamic>>.from(

        allChats[currentChatIndex]

            ["messages"],

      );


      

    });



    int index =

        allChats[currentChatIndex]

                    ["messages"]

                .length -

            1;


await streamAIResponse(
  userText,
  index,
  historyForAI,
);

if (mounted) {
  setState(() {
    isLoading = false;
  });
}

await saveChat();

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

void showAttachmentMenu() {
  showModalBottomSheet(
    context: context,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(
        top: Radius.circular(25),
      ),
    ),
    builder: (context) {
      return SafeArea(
        child: Wrap(
          children: [

            ListTile(
              leading: const Icon(Icons.image),
              title: const Text("Image"),
              onTap: () {
                Navigator.pop(context);
                pickImage();
              },
            ),
ListTile(
  leading: const Icon(Icons.picture_as_pdf),
  title: const Text("PDF"),
  onTap: () async {
    Navigator.pop(context);
    await pickPdf();
  },
),

            ListTile(
              leading: const Icon(Icons.camera_alt),
              title: const Text("Camera"),
              onTap: () {
                Navigator.pop(context);

                // Camera feature ???? add ???
              },
            ),

          ],
        ),
      );
    },
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

 Widget chatBubble(
  Map<String, dynamic> msg,
  int index,
) {
  final bool isUser = msg["role"] == "user";

  final String previousUserText = (index > 0)
      ? (messages[index - 1]["role"] == "user"
          ? (messages[index - 1]["text"]?.toString() ?? "")
          : "")
      : "";

  final String currentText = msg["text"]?.toString() ?? "";

  final bool isTimeQuery = !isUser &&
      RegExp(
        r'\b(time|clock|current time|what time|local time|time now)\b',
        caseSensitive: false,
      ).hasMatch(previousUserText);

  final List<Map<String, dynamic>> sources =
      List<Map<String, dynamic>>.from(
    msg["sources"] ?? [],
  );

  final List<String> followUps =
      (msg["followUps"] is List)
          ? (msg["followUps"] as List)
              .map((e) => e.toString())
              .where((e) => e.trim().isNotEmpty)
              .take(3)
              .toList()
          : [];

  final String followUpHeading =
      msg["followUpHeading"]?.toString() ?? "";
      
  
 

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

                  final editController =
                      TextEditingController(
                    text: msg["text"] ?? "",
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
                  controller.clear();
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

      margin: EdgeInsets.only(
        top: 8,
        bottom: 8,
        left: isUser ? 60 : 12,
        right: isUser ? 12 : 12,
      ),

      child: Column(
        crossAxisAlignment: isUser
            ? CrossAxisAlignment.end
            : CrossAxisAlignment.start,

        children: [

          // ==================================================
          // USER / AI HEADER
          // ==================================================

          Row(
  mainAxisSize: MainAxisSize.min,
  crossAxisAlignment: CrossAxisAlignment.center,
  children: [

    if (!isUser)
      Container(
        width: 30,
        height: 30,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: const LinearGradient(
            colors: [
              Color(0xff06B6D4),
              Color(0xff3B82F6),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.cyan.withOpacity(0.20),
              blurRadius: 7,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: const Center(
          child: Text(
            "V",
            style: TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
              fontSize: 15,
            ),
          ),
        ),
      ),

    if (!isUser)
      const SizedBox(width: 9),

    Text(
      isUser ? "You" : "VedaAI",
      style: TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.2,
        color: isDarkMode
            ? Colors.white70
            : Colors.black54,
      ),
    ),

    if (isUser)
      const SizedBox(width: 6),

    if (isUser)
      Icon(
        Icons.person_outline,
        size: 18,
        color: isDarkMode
            ? Colors.white70
            : Colors.black54,
      ),
  ],
),

          const SizedBox(height: 6),

          // ==================================================
// MESSAGE CONTENT
// ==================================================

// ATTACHED IMAGE
if (msg["image"] != null &&
    msg["image"].toString().isNotEmpty)
  Padding(
    padding: EdgeInsets.only(
      left: isUser ? 0 : 36,
      right: 16,
      bottom: 8,
    ),
    child: Align(
      alignment: isUser
          ? Alignment.centerRight
          : Alignment.centerLeft,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Image.file(
          File(msg["image"].toString()),
          width: 220,
          height: 220,
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) {
            return Container(
              width: 220,
              height: 120,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: isDarkMode
                    ? const Color(0xff1E293B)
                    : const Color(0xffF1F5F9),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(
                Icons.broken_image_outlined,
                size: 40,
                color: Colors.grey,
              ),
            );
          },
        ),
      ),
    ),
  ),
// THINKING / TEXT
if (msg["thinking"] == true)
  Padding(
    padding: const EdgeInsets.only(
      left: 36,
      top: 4,
      bottom: 6,
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          "Thinking",
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            letterSpacing: 0.2,
            color: isDarkMode
                ? Colors.white70
                : Colors.black54,
          ),
        ),

        const SizedBox(width: 8),

        LoadingAnimationWidget.threeArchedCircle(
          size: 18,
          color: isDarkMode
              ? const Color(0xff38BDF8)
              : const Color(0xff06B6C4),
        ),
      ],
    ),
  )
else
  Padding(
    padding: EdgeInsets.only(
      left: isUser ? 0 : 36,
      right: isUser ? 0 : 16,
      top: isUser ? 0 : 2,
      bottom: isUser ? 0 : 2,
    ),
    child: Container(
      padding: EdgeInsets.symmetric(
        horizontal: isUser ? 16 : 14,
        vertical: isUser ? 11 : 10,
      ),
      decoration: isUser
          ? BoxDecoration(
              color: isDarkMode
                  ? const Color(0xff2563EB)
                  : const Color(0xffE8F0FE),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(18),
                topRight: Radius.circular(18),
                bottomLeft: Radius.circular(18),
                bottomRight: Radius.circular(5),
              ),
            )
          : BoxDecoration(
              color: isDarkMode
                  ? const Color(0xff111827)
                  : const Color(0xffF8FAFC),
              borderRadius: BorderRadius.circular(14),
            ),
      child: MarkdownBody(
        data: msg["text"] ?? "",
        selectable: true,
        sizedImageBuilder: (config) {
  return ClipRRect(
    borderRadius: BorderRadius.circular(12),
    child: Image.network(
      config.uri.toString(),
      width: double.infinity,
      fit: BoxFit.contain,
      loadingBuilder: (context, child, loadingProgress) {
        if (loadingProgress == null) return child;

        return const Padding(
          padding: EdgeInsets.all(20),
          child: Center(
            child: CircularProgressIndicator(),
          ),
        );
      },
      errorBuilder: (context, error, stackTrace) {
        return const Padding(
          padding: EdgeInsets.all(12),
          child: Text("Image could not be loaded."),
        );
      },
    ),
  );
},
        styleSheet: MarkdownStyleSheet(
          p: TextStyle(
            fontSize: 16,
            height: 1.65,
            color: isDarkMode
                ? Colors.white
                : Colors.black87,
          ),

          h1: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: isDarkMode
                ? Colors.white
                : Colors.black,
          ),

          h2: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: isDarkMode
                ? Colors.white
                : Colors.black,
          ),

          h3: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: isDarkMode
                ? Colors.white
                : Colors.black,
          ),

          code: TextStyle(
            fontSize: 14,
            color: isDarkMode
                ? Colors.white
                : Colors.black87,
          ),
        ),
      ),
    ),
  ),
            // ==================================================
            // LIVE CLOCK CARD
            if (isTimeQuery &&
                msg["thinking"] != true &&
                previousUserText.isNotEmpty)
              VedaLiveClock(
                city: "India",
                timeZone: "Asia/Kolkata",
              ),
 // VEDAAI IMAGE RESULTS CARD
 // ==================================================

 if (!isUser &&
     msg["thinking"] != true &&
     msg["images"] is List &&
     (msg["images"] as List).isNotEmpty)
   Padding(
     padding: const EdgeInsets.only(left: 36, right: 16, top: 8, bottom: 8),
     child: SizedBox(
       height: 190,
       child: ListView.separated(
         scrollDirection: Axis.horizontal,
         itemCount: (msg["images"] as List).length,
         separatorBuilder: (_, __) => const SizedBox(width: 10),
         itemBuilder: (context, imageIndex) {
           final image = Map<String, dynamic>.from(
             (msg["images"] as List)[imageIndex] as Map,
           );
           final imageUrl = image["url"]?.toString() ?? "";
           final imageTitle = image["title"]?.toString() ?? "Image";

           return SizedBox(
             width: 160,
             child: Card(
               clipBehavior: Clip.antiAlias,
               margin: EdgeInsets.zero,
               child: Column(
                 crossAxisAlignment: CrossAxisAlignment.start,
                 children: [
                   Expanded(
                     child: Image.network(
                       imageUrl,
                       width: double.infinity,
                       fit: BoxFit.cover,
                       loadingBuilder: (context, child, progress) {
                         if (progress == null) return child;
                         return const Center(
                           child: CircularProgressIndicator(),
                         );
                       },
                       errorBuilder: (context, error, stackTrace) {
                         return const Center(
                           child: Icon(Icons.broken_image_outlined, size: 36),
                         );
                       },
                     ),
                   ),
                   Padding(
                     padding: const EdgeInsets.all(8),
                     child: Text(
                       imageTitle,
                       maxLines: 2,
                       overflow: TextOverflow.ellipsis,
                       style: const TextStyle(fontSize: 12),
                     ),
                   ),
                 ],
               ),
             ),
           );
         },
       ),
     ),
   ),
// PRODUCT CARD
// ==================================================

if (!isUser &&
    msg["thinking"] != true &&
    msg["product"] is Map)
  productCard(
    Map<String, dynamic>.from(
      msg["product"],
    ),
  ),
          // ==================================================
          // COPY BUTTON
          // ==================================================

          if (!isUser &&
              msg["thinking"] != true)

            Padding(
              padding: const EdgeInsets.only(
                left: 36,
                top: 5,
              ),

              child: Align(
                alignment:
                    Alignment.centerLeft,

                child: InkWell(
                  borderRadius:
                      BorderRadius.circular(8),

                  onTap: () async {
                    await Clipboard.setData(
                      ClipboardData(
                        text: msg["text"] ?? "",
                      ),
                    );

                    setState(() {
                      copiedMessageIndex = index;
                    });

                    Future.delayed(
                      const Duration(
                        seconds: 2,
                      ),
                      () {
                        if (!mounted) return;

                        setState(() {
                          copiedMessageIndex =
                              -1;
                        });
                      },
                    );
                  },

                  child: Padding(
                    padding:
                        const EdgeInsets.all(6),

                    child: Row(
                      mainAxisSize:
                          MainAxisSize.min,
                      children: [

                        Icon(
                          copiedMessageIndex ==
                                  index
                              ? Icons.check
                              : Icons.copy,
                          size: 16,
                          color: isDarkMode
                              ? Colors.white54
                              : Colors.black45,
                        ),

                        const SizedBox(
                          width: 5,
                        ),

                        Text(
                          copiedMessageIndex ==
                                  index
                              ? "Copied"
                              : "Copy",
                          style: TextStyle(
                            fontSize: 11,
                            color: isDarkMode
                                ? Colors.white54
                                : Colors.black45,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),

          // ==================================================
// SOURCES ? SOURCE LOGOS
// ==================================================

if (!isUser && sources.isNotEmpty)
  Padding(
    padding: const EdgeInsets.only(
      left: 36,
      top: 6,
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: sources.map((source) {
        final title =
            source["title"]?.toString() ?? "";

        final domain =
            source["domain"]?.toString() ?? "";

        final url =
            source["url"]?.toString() ?? "";

        // Source website favicon/logo
        final logoUrl = domain.isNotEmpty
            ? "https://www.google.com/s2/favicons?domain=$domain&sz=64"
            : "";

        return Padding(
          padding: const EdgeInsets.only(right: 6),
          child: GestureDetector(
            onTap: url.isEmpty
                ? null
                : () async {
                    final uri = Uri.tryParse(url);

                    if (uri == null) return;

                    try {
                      await launchUrl(
                        uri,
                        mode: LaunchMode.externalApplication,
                      );
                    } catch (e) {
                      print("SOURCE URL ERROR: $e");
                    }
                  },

            child: Tooltip(
              message: title.isNotEmpty
                  ? title
                  : domain,

              child: Container(
                width: 32,
                height: 32,

                decoration: BoxDecoration(
                  shape: BoxShape.circle,

                  color: isDarkMode
                      ? const Color(0xff1E293B)
                      : const Color(0xffF1F5F9),

                  border: Border.all(
                    color: isDarkMode
                        ? Colors.white12
                        : Colors.black12,
                  ),
                ),

                padding: const EdgeInsets.all(5),

                child: logoUrl.isNotEmpty
                    ? ClipOval(
                        child: Image.network(
                          logoUrl,
                          fit: BoxFit.contain,

                          errorBuilder:
                              (context, error, stackTrace) {
                            return Icon(
                              Icons.language,
                              size: 18,
                              color: isDarkMode
                                  ? Colors.white54
                                  : Colors.black45,
                            );
                          },
                        ),
                      )
                    : Icon(
                        Icons.language,
                        size: 18,
                        color: isDarkMode
                            ? Colors.white54
                            : Colors.black45,
                      ),
              ),
            ),
          ),
        );
      }).toList(),
    ),
  ),
         // ==================================================
// DYNAMIC FOLLOW-UP QUESTIONS
// ==================================================

if (!isUser &&
    msg["thinking"] != true &&
    followUps.isNotEmpty)
  Padding(
    padding: const EdgeInsets.only(
      left: 36,
      right: 12,
      top: 14,
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [

        if (followUpHeading.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(
              bottom: 7,
            ),
            child: Text(
              followUpHeading,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: isDarkMode
                    ? Colors.white60
                    : Colors.black54,
              ),
            ),
          ),

        ...followUps.take(3).map(
          (question) => Padding(
            padding: const EdgeInsets.only(
              bottom: 5,
            ),
            child: Text(
              question,
              style: TextStyle(
                fontSize: 14,
                height: 1.5,
                color: isDarkMode
                    ? Colors.white70
                    : Colors.black54,
              ),
            ),
          ),
        ),
      ],
    ),
  ),
          // ==================================================
          // PINNED
          // ==================================================

          if (msg["pinned"] == true)

            Padding(
              padding:
                  const EdgeInsets.only(
                left: 36,
                top: 6,
              ),

              child: Row(
                children: const [
                  Icon(
                    Icons.push_pin,
                    size: 13,
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
  );
}

// ==================================================
// PRODUCT INFORMATION CARD
// ==================================================

Widget productCard(Map<String, dynamic> product) {
  final String name =
      product["name"]?.toString() ?? "";

  final String image =
      product["image"]?.toString() ?? "";

  final String price =
      product["price"]?.toString() ?? "";

  final String description =
      product["description"]?.toString() ?? "";

  if (name.isEmpty) {
    return const SizedBox.shrink();
  }

  return Padding(
    padding: const EdgeInsets.only(
      left: 36,
      right: 12,
      top: 12,
    ),

    child: Container(
      width: double.infinity,

      decoration: BoxDecoration(
        color: isDarkMode
            ? const Color(0xff111827)
            : Colors.white,

        borderRadius:
            BorderRadius.circular(16),

        border: Border.all(
          color: isDarkMode
              ? Colors.white12
              : Colors.black12,
        ),

        boxShadow: [
          BoxShadow(
            color:
                Colors.black.withOpacity(0.06),
            blurRadius: 10,
            offset:
                const Offset(0, 4),
          ),
        ],
      ),

      child: Column(
        crossAxisAlignment:
            CrossAxisAlignment.start,

        children: [

          // ==================================================
          // PRODUCT IMAGE
          // ==================================================

          if (image.isNotEmpty)
            ClipRRect(
              borderRadius:
                  const BorderRadius.vertical(
                top: Radius.circular(16),
              ),

              child: Image.network(
                image,

                width: double.infinity,
                height: 210,

                fit: BoxFit.contain,

                errorBuilder:
                    (context, error, stackTrace) {
                  return SizedBox(
                    height: 210,

                    child: Center(
                      child: Icon(
                        Icons
                            .image_not_supported_outlined,

                        size: 50,

                        color: isDarkMode
                            ? Colors.white38
                            : Colors.black26,
                      ),
                    ),
                  );
                },
              ),
            ),

          // ==================================================
          // PRODUCT DETAILS
          // ==================================================

          Padding(
            padding:
                const EdgeInsets.all(14),

            child: Column(
              crossAxisAlignment:
                  CrossAxisAlignment.start,

              children: [

                // PRODUCT NAME
                Text(
                  name,

                  style: TextStyle(
                    fontSize: 17,
                    fontWeight:
                        FontWeight.w700,

                    color: isDarkMode
                        ? Colors.white
                        : Colors.black87,
                  ),
                ),

                // PRICE
                if (price.isNotEmpty) ...[
                  const SizedBox(height: 7),

                  Text(
                    price,

                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight:
                          FontWeight.bold,

                      color:
                          Color(0xff2563EB),
                    ),
                  ),
                ],

                // DESCRIPTION
                if (description.isNotEmpty) ...[
                  const SizedBox(height: 8),

                  Text(
                    description,

                    maxLines: 4,

                    overflow:
                        TextOverflow.ellipsis,

                    style: TextStyle(
                      fontSize: 13,
                      height: 1.4,

                      color: isDarkMode
                          ? Colors.white60
                          : Colors.black54,
                    ),
                  ),
                ],
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

  final displayChats = [
    ...allChats.where((chat) => chat["pinned"] == true),
    ...allChats.where((chat) => chat["pinned"] != true),
  ];

  final pinnedChats = allChats
      .where((chat) => chat["pinned"] == true)
      .toList();

  final recentChats = allChats
    .where((chat) => chat["pinned"] != true)
    .toList()
  ..sort((a, b) {
    final aTime = a["updatedAt"] ?? 0;
    final bTime = b["updatedAt"] ?? 0;

    return (bTime as num).compareTo(aTime as num);
  });

  return Scaffold(
    backgroundColor: isDarkMode
    ? const Color(0xff0F172A)
    : const Color(0xffF8FAFC),
    


   drawer: Drawer(
  backgroundColor: isDarkMode ? Colors.black : Colors.white,

  child: Column(
    children: [

     Container(
  width: double.infinity,

  child: Container(
    padding: const EdgeInsets.all(12),

    decoration: const BoxDecoration(
      gradient: LinearGradient(
        colors: [
          Color(0xff2563EB),
          Color(0xff4F46E5),
        ],
      ),
    ),

    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.start,
     

      children: [

        const CircleAvatar(
          radius: 24,
          backgroundColor: Colors.white,
          child: Icon(
            Icons.person,
            color: Colors.blue,
            size: 34,
          ),
        ),

        const SizedBox(height: 10),

        Text(
  userName,
  maxLines: 1,
  overflow: TextOverflow.ellipsis,
  style: const TextStyle(
    color: Colors.white,
    fontSize: 16,
    fontWeight: FontWeight.w600,
  ),
),

        const SizedBox(height: 5),

        const SizedBox(height: 5),

Text(
  isPremium
      ? "${subscriptionType.toUpperCase()}"
: "Free Plan",
  style: const TextStyle(
    color: Colors.white70,
    fontSize: 14,
  ),
),

const SizedBox(height: 12),

if (!isPremium)
  SizedBox(
    width: double.infinity,
    child: ElevatedButton.icon(
      icon: const Icon(Icons.workspace_premium),
      label: const Text("Upgrade to Premium"),
      style: ElevatedButton.styleFrom(
        backgroundColor: const Color(0xffF59E0B),
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(vertical: 12),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
      onPressed: () {
        Navigator.pop(context);

        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => const SubscriptionScreen(),
          ),
        );
      },
    ),
  ),

      ],
    ),
  ),
),
      // ?? NEW CHAT
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

ListTile(
  leading: Icon(
    Icons.search,
    color: isDarkMode
        ? Colors.white
        : Colors.black,
  ),

  title: Text(
    "Search Chats",
    style: TextStyle(
      color: isDarkMode
          ? Colors.white
          : Colors.black,
    ),
  ),

  onTap: () async {

    Navigator.pop(context);

    final selectedChat = await showSearch<Map<String, dynamic>>(
      context: context,
      delegate: ChatSearchDelegate(allChats),
    );

    if (selectedChat == null) return;

    final chatIndex = allChats.indexOf(selectedChat);

    if (chatIndex == -1) return;

    setState(() {
      currentChatIndex = chatIndex;
      messages = List<Map<String, dynamic>>.from(
        allChats[chatIndex]["messages"] ?? [],
      );
    });
  },
),

      const Divider(),
      
// ?? CHAT LIST
Expanded(
  child: Scrollbar(
    thumbVisibility: false,
    thickness: 5,
    radius: const Radius.circular(10),
    child: ListView.builder(
      physics: const BouncingScrollPhysics(
        parent: AlwaysScrollableScrollPhysics(),
      ),
      padding: const EdgeInsets.only(
        top: 4,
        bottom: 16,
      ),
    itemCount:
        (pinnedChats.isNotEmpty ? pinnedChats.length + 1 : 0) +
        (recentChats.isNotEmpty ? recentChats.length + 1 : 0),

    itemBuilder: (context, index) {

           // ==============================
      // PINNED SECTION
      // ==============================

      if (pinnedChats.isNotEmpty) {

        // ?? PINNED HEADER
        if (index == 0) {
          return const Padding(
            padding: EdgeInsets.fromLTRB(16, 14, 16, 6),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                " Pinned",
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 15,
                ),
              ),
            ),
          );
        }

        // ?? PINNED CHAT
        if (index <= pinnedChats.length) {

          final chat = pinnedChats[index - 1];

          final originalIndex =
              allChats.indexOf(chat);

          return ListTile(
            leading: const Icon(Icons.push_pin),

            title: Text(
              chat["title"] ?? "New Chat",
              overflow: TextOverflow.ellipsis,
            ),

            selected:
                originalIndex == currentChatIndex,

            selectedTileColor: isDarkMode
                ? Colors.white12
                : Colors.black12,

            onTap: () {

              if (originalIndex == -1) return;

              setState(() {

                currentChatIndex =
                    originalIndex;

                messages =
                    List<Map<String, dynamic>>.from(
                  chat["messages"] ?? [],
                );

              });

              Navigator.pop(context);
            },
          );
        }
      }

      // ==============================
      // RECENTS SECTION
      // ==============================

      final recentHeaderIndex =
          pinnedChats.isNotEmpty
              ? pinnedChats.length + 1
              : 0;

      // ?? RECENTS HEADER
      if (index == recentHeaderIndex) {

        return const Padding(
          padding: EdgeInsets.fromLTRB(
            16,
            18,
            16,
            6,
          ),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text(
              "Recents",
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 15,
              ),
            ),
          ),
        );
      }

      // ?? RECENT CHAT
      final recentIndex =
          index - recentHeaderIndex - 1;

      final chat =
          recentChats[recentIndex];

      final originalIndex =
          allChats.indexOf(chat);



      return ListTile(
        leading: Icon(
          chat["favorite"] == true
              ? Icons.star
              : Icons.chat,
          color: chat["favorite"] == true
              ? Colors.orange
              : (isDarkMode
                  ? Colors.white
                  : Colors.black),
        ),

        title: Row(
          children: [
            Expanded(
              child: Text(
                chat["title"] ?? "New Chat",
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: isDarkMode
                      ? Colors.white
                      : Colors.black,
                ),
              ),
            ),

            // ?? PINNED INDICATOR
            if (chat["pinned"] == true)
              Padding(
                padding: const EdgeInsets.only(left: 6),
                child: Icon(
                  Icons.push_pin,
                  size: 17,
                  color: isDarkMode
                      ? Colors.white70
                      : Colors.black54,
                ),
              ),

            // ?? PAUSED BADGE
            if (
              !isOwner &&
              !isPremium &&
              chat["paused"] == true
            )
              Container(
                margin: const EdgeInsets.only(left: 8),
                padding: const EdgeInsets.symmetric(
                  horizontal: 7,
                  vertical: 3,
                ),
                decoration: BoxDecoration(
                  color: isDarkMode
                      ? Colors.white12
                      : Colors.black12,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  "? Paused",
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: isDarkMode
                        ? Colors.white70
                        : Colors.black54,
                  ),
                ),
              ),
          ],
        ),

        selected: originalIndex == currentChatIndex,

        selectedTileColor: isDarkMode
            ? Colors.white12
            : Colors.black12,

        // ?? OPEN CHAT
       onTap: () {
  if (originalIndex == -1) return;

  controller.clear();

  setState(() {
    currentChatIndex = originalIndex;

    messages = List<Map<String, dynamic>>.from(
      chat["messages"] ?? [],
    );
  });

  Navigator.pop(context);
},

        // ?? CHAT OPTIONS
        onLongPress: () {
          showDialog(
            context: context,
            builder: (context) {
              return AlertDialog(
                title: const Text("Chat Options"),
                content: const Text("Choose an action"),
                actions: [

                  // ?? FAVORITE
                  TextButton(
                    onPressed: () async {
                      setState(() {
                        chat["favorite"] =
                            !(chat["favorite"] ?? false);
                      });

                      await saveChat();

                      Navigator.pop(context);
                    },
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          chat["favorite"] == true
                              ? Icons.star
                              : Icons.star_outline,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          chat["favorite"] == true
                              ? "Remove Star"
                              : "Add Star",
                        ),
                      ],
                    ),
                  ),

                  // Rename
                  TextButton(
                    onPressed: () async {
                      final controller =
                          TextEditingController(
                        text: chat["title"] ?? "New Chat",
                      );

                      final newTitle =
                          await showDialog<String>(
                        context: context,
                        builder: (dialogContext) {
                          return AlertDialog(
                            title:
                                const Text("Rename Chat"),
                            content: TextField(
                              controller: controller,
                              autofocus: true,
                              maxLength: 60,
                              decoration:
                                  const InputDecoration(
                                hintText:
                                    "Enter chat name",
                                border:
                                    OutlineInputBorder(),
                              ),
                            ),
                            actions: [
                              TextButton(
                                onPressed: () {
                                  Navigator.pop(
                                      dialogContext);
                                },
                                child:
                                    const Text("Cancel"),
                              ),
                              ElevatedButton(
                                onPressed: () {
                                  final title =
                                      controller.text
                                          .trim();

                                  if (title.isNotEmpty) {
                                    Navigator.pop(
                                      dialogContext,
                                      title,
                                    );
                                  }
                                },
                                child:
                                    const Text("Save"),
                              ),
                            ],
                          );
                        },
                      );

                      controller.dispose();

                      if (newTitle == null ||
                          newTitle.trim().isEmpty) {
                        return;
                      }

                      await renameChat(
                        originalIndex,
                        newTitle.trim(),
                      );

                      Navigator.pop(context);
                    },
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.edit_outlined),
                        SizedBox(width: 8),
                        Text("Rename"),
                      ],
                    ),
                  ),

                  // ?? PIN / UNPIN
                  TextButton(
                    onPressed: () async {
                      setState(() {
                        chat["pinned"] =
                            !(chat["pinned"] ?? false);
                      });

                      await saveChat();

                      Navigator.pop(context);
                    },
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          chat["pinned"] == true
                              ? Icons.push_pin
                              : Icons.push_pin_outlined,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          chat["pinned"] == true
                              ? "Unpin"
                              : "Pin",
                        ),
                      ],
                    ),
                  ),

                  // ?? CANCEL
                  TextButton(
                    onPressed: () {
                      Navigator.pop(context);
                    },
                    child: const Text("Cancel"),
                  ),

                  // ?? DELETE
                  TextButton(
                    style: TextButton.styleFrom(
                      foregroundColor: Colors.red,
                    ),
                    onPressed: () async {
                      final shouldDelete =
                          await showDialog<bool>(
                        context: context,
                        builder: (dialogContext) {
                          return AlertDialog(
                            title:
                                const Text("Delete Chat?"),
                            content: const Text(
                              "This chat will be permanently removed. Continue?",
                            ),
                            actions: [
                              TextButton(
                                onPressed: () {
                                  Navigator.pop(
                                    dialogContext,
                                    false,
                                  );
                                },
                                child:
                                    const Text("Cancel"),
                              ),
                              TextButton(
                                style:
                                    TextButton.styleFrom(
                                  foregroundColor:
                                      Colors.red,
                                ),
                                onPressed: () {
                                  Navigator.pop(
                                    dialogContext,
                                    true,
                                  );
                                },
                                child:
                                    const Text("Delete"),
                              ),
                            ],
                          );
                        },
                      );

                      if (shouldDelete != true) return;

                      setState(() {
                        if (originalIndex >= 0 &&
                            originalIndex <
                                allChats.length) {
                          allChats.removeAt(originalIndex);
                        }

                        if (allChats.isEmpty) {
                          allChats.insert(
                            0,
                            {
                              "id": DateTime.now()
                                  .millisecondsSinceEpoch
                                  .toString(),
                              "title": "New Chat",
                              "messages":
                                  <Map<String, dynamic>>[],
                              "favorite": false,
                              "pinned": false,
                              "messageCount": 0,
                              "paused": false,
                              "resetTime": null,
                            },
                          );

                          currentChatIndex = 0;
                          messages = [];
                        } else if (
                            currentChatIndex >=
                            allChats.length) {
                          currentChatIndex =
                              allChats.length - 1;

                          messages =
                              List<Map<String, dynamic>>.from(
                            allChats[currentChatIndex]
                                    ["messages"] ??
                                [],
                          );
                        }
                      });

                      await saveChat();

                      Navigator.pop(context);
                    },
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.delete_outline),
                        SizedBox(width: 8),
                        Text("Delete"),
                      ],
                    ),
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
      ),
      const Divider(),




const Divider(),

ListTile(
  leading: const Icon(Icons.info_outline),
  title: const Text("About VedaAI"),
  onTap: () {
    Navigator.pop(context);

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text("About VedaAI"),
          content: const Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "VedaAI",
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                ),
              ),
              SizedBox(height: 12),

              Text(
                "VedaAI is an AI-powered assistant designed "
                "for study, coding, document analysis and "
                "everyday questions.",
              ),

              SizedBox(height: 16),

              Text(
                "Created by",
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                ),
              ),

              SizedBox(height: 4),

              Text("Yash Krishnat Patil"),

              SizedBox(height: 16),

              Text(
                "Version 1.0.0",
                style: TextStyle(
                  color: Colors.grey,
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(context);
              },
              child: const Text("Close"),
            ),
          ],
        );
      },
    );
  },
),

ListTile(
  leading: const Icon(Icons.privacy_tip_outlined),
  title: const Text("Privacy Policy"),
  onTap: () {
    Navigator.pop(context);

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text("Privacy Policy"),
          content: const SingleChildScrollView(
            child: Text(
              "VedaAI Privacy Policy\n\n"
              "1. Information We Collect\n\n"
              "VedaAI may process information such as your "
              "account details, chat messages, uploaded images, "
              "and PDF documents when you use the app.\n\n"
              "2. How We Use Information\n\n"
              "Information is used to provide AI responses, "
              "process uploaded content, maintain chat history, "
              "and provide app features and support.\n\n"
              "3. AI Processing\n\n"
              "When you send a message, image, or PDF for AI "
              "processing, the required content may be sent to "
              "the AI service used by VedaAI to generate a response.\n\n"
              "4. Uploaded Files\n\n"
              "Images and PDF files are processed to provide "
              "the requested AI functionality. Do not upload "
              "highly sensitive or confidential information.\n\n"
              "5. Account and Security\n\n"
              "Authentication information is used to protect "
              "your account and provide access to VedaAI features. "
              "We take reasonable measures to protect stored data.\n\n"
              "6. Payments\n\n"
              "Premium subscription payments are processed through "
              "the payment service used by VedaAI. VedaAI does not "
              "store your complete card or banking credentials.\n\n"
              "7. Contact\n\n"
              "For privacy or support questions, contact us at:\n"
              "vedaaiking25@gmail.com\n\n"
              "8. Policy Updates\n\n"
              "This Privacy Policy may be updated when VedaAI "
              "features or data practices change."
            ),
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(context);
              },
              child: const Text("Close"),
            ),
          ],
        );
      },
    );
  },
),


ListTile(
  leading: const Icon(Icons.support_agent),
  title: const Text("Contact Support"),
  onTap: () async {
    Navigator.pop(context);

    final Uri emailUri = Uri(
      scheme: 'mailto',
      path: 'vedaaiking25@gmail.com',
      queryParameters: {
        'subject': 'VedaAI Support',
        'body': 'Hello VedaAI Support Team,\n\n',
      },
    );

    if (await canLaunchUrl(emailUri)) {
      await launchUrl(emailUri);
    } else {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            "No email app is available on this device.",
          ),
        ),
      );
    }
  },
),

const Divider(),

ListTile(
  leading: const Icon(
    Icons.logout,
    color: Colors.red,
  ),
  title: const Text(
    "Logout",
    style: TextStyle(
      color: Colors.red,
      fontWeight: FontWeight.bold,
    ),
  ),
  onTap: () {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text("Logout"),
        content: const Text(
          "Are you sure you want to logout?",
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Row(
  mainAxisSize: MainAxisSize.min,
  children: [
    Icon(Icons.close),
    SizedBox(width: 8),
    Text("Cancel"),
  ],
),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
            ),
            onPressed: () {
              Navigator.pop(context);
              logout();
            },
            child: const Text(
              "Logout",
              style: TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
    );
  },
),
    ],
  ),
),
    appBar: AppBar(
  elevation: 0,
 backgroundColor: isDarkMode
    ? const Color(0xff0F172A)
    : const Color(0xffF8FAFC),
iconTheme: IconThemeData(
  color: isDarkMode ? Colors.white : Colors.black87,
),
  title: Row(
    children: [

      Container(
  height: 40,
  width: 40,
  decoration: BoxDecoration(
    gradient: const LinearGradient(
      colors: [
        Color(0xff2563EB),
        Color(0xff7C3AED),
      ],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    borderRadius: BorderRadius.circular(12),
    boxShadow: const [
      BoxShadow(
        color: Colors.black26,
        blurRadius: 10,
        offset: Offset(0, 4),
      ),
    ],
  ),

  child: const Icon(
    Icons.psychology,
    color: Colors.white,
    size: 25,
  ),
),

      const SizedBox(width: 12),

      
      const Text(
  "VedaAI",
  overflow: TextOverflow.visible,
  style: TextStyle(
    fontSize: 20,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
    color: Color(0xff2563EB),
  ),
),

    ],
  ),

 actions: [


  // ?? Share Chat
  IconButton(
    tooltip: "Share Chat",
    icon: const Icon(Icons.share),
    onPressed: () {
      
      exportChat(); 
    },
  ),

  // ?? Notifications
 IconButton(
  tooltip: "Notifications",
  icon: const Icon(Icons.notifications_none),
  onPressed: () {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => const NotificationsScreen(),
      ),
    );
  },
),

  // ? More
  PopupMenuButton<String>(
    icon: const Icon(Icons.more_vert),
    onSelected: (value) {

      switch (value) {

        case "about":
          break;

        case "privacy":
          break;

       case "contact":
  final Uri emailUri = Uri(
    scheme: 'mailto',
    path: 'vedaaiking25@gmail.com',
    queryParameters: {
      'subject': 'VedaAI Support',
      'body': 'Hello VedaAI Support Team,\n\n',
    },
  );

  launchUrl(emailUri);
  break;

      }

    },

    itemBuilder: (context) => const [

      PopupMenuItem(
        value: "about",
        child: Text("About VedaAI"),
      ),

      PopupMenuItem(
        value: "privacy",
        child: Text("Privacy Policy"),
      ),

      PopupMenuItem(
        value: "contact",
        child: Text("Contact Support"),
      ),

    ],
  ),

], 
    ),
    // ?? BODY
    body: SafeArea(
      child: Column(
        children: [


          // CHAT LIST
         if (messages.any((m) => m["pinned"] == true))
  Container(
    padding: const EdgeInsets.all(8),
    color: Colors.yellow.shade100,
    child: Text("Pinned Message"),
  ),
 // ================= PAUSED CARD =================

if (
  !isOwner &&
  !isPremium &&
  isCurrentChatPaused
)
  Container(
    width: double.infinity,
    margin: const EdgeInsets.fromLTRB(12, 8, 12, 12),
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: isDarkMode
          ? const Color(0xff1E1E1E)
          : const Color(0xffF8F8F8),
      borderRadius: BorderRadius.circular(18),
      border: Border.all(
        color: isDarkMode
            ? Colors.white24
            : Colors.black12,
      ),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [

        // ? ICON
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: isDarkMode
                ? Colors.white10
                : Colors.black.withOpacity(0.05),
            shape: BoxShape.circle,
          ),
          child: Icon(
            Icons.pause_rounded,
            size: 28,
            color: isDarkMode
                ? Colors.white
                : Colors.black87,
          ),
        ),

        const SizedBox(height: 12),

        // TITLE
        Text(
          "Chats paused",
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 19,
            fontWeight: FontWeight.w700,
            color: isDarkMode
                ? Colors.white
                : Colors.black87,
          ),
        ),

        const SizedBox(height: 8),

        // MESSAGE
        Text(
          "You've reached the message limit\nfor this chat.",
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 14,
            height: 1.5,
            color: isDarkMode
                ? Colors.white70
                : Colors.black54,
          ),
        ),

        const SizedBox(height: 16),

        // TIMER LABEL
        Text(
          "Try again in",
          style: TextStyle(
            fontSize: 13,
            color: isDarkMode
                ? Colors.white60
                : Colors.black45,
          ),
        ),

        const SizedBox(height: 4),

        // TIMER
       Text(
  remainingTime.isEmpty ? "04:00:00" : remainingTime,
  style: TextStyle(
    fontSize: 24,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
    color: isDarkMode
        ? Colors.white
        : Colors.black87,
  ),
),

        const SizedBox(height: 18),

        // BUTTONS
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [

            // NEW CHAT
            Expanded(
              child: OutlinedButton.icon(
                onPressed: newChat,
                icon: const Icon(Icons.add),
                label: const Text("New Chat"),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(
                    vertical: 12,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),

            const SizedBox(width: 10),

            // UPGRADE
            Expanded(
              child: ElevatedButton.icon(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) =>
                          const SubscriptionScreen(),
                    ),
                  );
                },
                icon: const Icon(
                  Icons.workspace_premium,
                ),
                label: const Text("Upgrade"),
                style: ElevatedButton.styleFrom(
                  backgroundColor:
                      const Color(0xffF59E0B),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                    vertical: 12,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    ),
  ),

if (showWelcomeScreen && messages.isEmpty)
  Expanded(
    child: Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 76,
              height: 76,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const LinearGradient(
                  colors: [
                    Color(0xff2563EB),
                    Color(0xff7C3AED),
                  ],
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.blue.withOpacity(0.20),
                    blurRadius: 25,
                    spreadRadius: 3,
                  ),
                ],
              ),
              child: const Center(
                child: Text(
                  "ðŸ‘‘",
                  style: TextStyle(fontSize: 36),
                ),
              ),
            ),

            const SizedBox(height: 24),

            Text(
              "${getTimeGreeting()}, $userName",
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w800,
                color: isDarkMode
                    ? Colors.white
                    : const Color(0xff0F172A),
              ),
            ),

            const SizedBox(height: 10),

            Text(
              "Welcome to VedaAI ðŸ‘‘",
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w600,
                color: isDarkMode
                    ? Colors.white70
                    : const Color(0xff334155),
              ),
            ),

            const SizedBox(height: 10),

            Text(
              "Your AI assistant for study, coding,\nsearch, images and documents.",
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                height: 1.5,
                color: isDarkMode
                    ? Colors.white54
                    : Colors.black54,
              ),
            ),

            const SizedBox(height: 18),

            SizedBox(
              width: 180,
              height: 48,
              child: ElevatedButton.icon(
                onPressed: newChat,
                icon: const Icon(Icons.add_rounded),
                label: const Text(
                  "New Chat",
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xff2563EB),
                  foregroundColor: Colors.white,
                  elevation: 4,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(15),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  ),
// ================= CHAT =================

Expanded(
  child: Stack(
    children: [

      // CHAT MESSAGES
      ListView.builder(
        controller: scrollController,
        padding: const EdgeInsets.only(bottom: 10),
        itemCount: messages.length,
        itemBuilder: (context, index) {

          return TweenAnimationBuilder<double>(
            key: ValueKey(
              messages[index]["id"] ??
              "${messages[index]["role"]}_${messages[index]["time"]}_$index",
            ),
            tween: Tween<double>(
              begin: 0.0,
              end: 1.0,
            ),
            duration: const Duration(milliseconds: 350),
            curve: Curves.easeOutCubic,
            builder: (context, value, child) {

              return Opacity(
                opacity: value,
                child: Transform.translate(
                  offset: Offset(
                    0,
                    12 * (1 - value),
                  ),
                  child: child,
                ),
              );
            },
            child: chatBubble(
              messages[index],
              index,
            ),
          );
        },
      ),

      // ================= SCROLL TO BOTTOM BUTTON =================

     if (showScrollButton)
  Positioned(
    left: 0,
    right: 0,
    bottom: 8,
    child: Center(
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: scrollToBottom,
          borderRadius: BorderRadius.circular(24),
          child: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: isDarkMode
                  ? const Color(0xff1E293B)
                  : Colors.white,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  blurRadius: 8,
                  spreadRadius: 1,
                  color: Colors.black.withOpacity(0.20),
                ),
              ],
            ),
            child: Icon(
              Icons.keyboard_arrow_down,
              size: 28,
              color: isDarkMode
                  ? Colors.white
                  : Colors.black87,
            ),
          ),
        ),
      ),
    ),
  ),
           
    ],
  ),
),



          // ?? TYPING INDICATOR
          if (isLoading)
  Center(
    child: LoadingAnimationWidget.threeArchedCircle(
      color: Colors.blue,
      size: 30,
    ),
  ),
if (selectedImage != null)
  Padding(
    padding: const EdgeInsets.all(8),
    child: Stack(
      children: [

        // IMAGE PREVIEW
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Image.file(
            selectedImage!,
            height: 150,
          ),
        ),

        // CLOSE BUTTON
        Positioned(
          top: 5,
          right: 5,
          child: GestureDetector(
            onTap: () {
              setState(() {
                selectedImage = null;
              });
            },
            child: Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.65),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.close,
                color: Colors.white,
                size: 20,
              ),
            ),
          ),
        ),
      ],
    ),
  ),
  if (selectedPdf != null)
  Padding(
    padding: const EdgeInsets.symmetric(
      horizontal: 12,
      vertical: 8,
    ),
    child: Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDarkMode
            ? const Color(0xff1E293B)
            : Colors.grey.shade100,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDarkMode
              ? Colors.white24
              : Colors.black12,
        ),
      ),
      child: Row(
        children: [

          // PDF ICON
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: Colors.red.withOpacity(0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.picture_as_pdf,
              color: Colors.red,
              size: 30,
            ),
          ),

          const SizedBox(width: 12),

          // PDF NAME
          Expanded(
            child: Text(
              selectedPdf!.path.split('\\').last,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: isDarkMode
                    ? Colors.white
                    : Colors.black87,
              ),
            ),
          ),

          // REMOVE PDF
          IconButton(
            icon: const Icon(
              Icons.close,
              color: Colors.grey,
            ),
            onPressed: () {
              setState(() {
                selectedPdf = null;
              });
            },
          ),
        ],
      ),
    ),
  ),
          // ==================================================
          // ?? INPUT BOX
          // ==================================================

          Padding(
            padding: const EdgeInsets.fromLTRB(12, 6, 12, 12),

            child: Container(
              padding: const EdgeInsets.fromLTRB(8, 6, 8, 6),

              decoration: BoxDecoration(
                color: isDarkMode
                    ? const Color(0xff1E293B)
                    : Colors.white,

                borderRadius: BorderRadius.circular(26),

                border: Border.all(
                  color: isDarkMode
                      ? Colors.white12
                      : Colors.black12,
                ),

                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(
                      isDarkMode ? 0.25 : 0.08,
                    ),
                    blurRadius: 12,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),

              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [

                  // IMAGE PREVIEW
                  if (selectedImage != null)
                    Container(
                      width: double.infinity,
                      margin: const EdgeInsets.fromLTRB(
                        4,
                        2,
                        4,
                        6,
                      ),
                      alignment: Alignment.centerLeft,

                      child: Stack(
                        children: [

                          ClipRRect(
                            borderRadius:
                                BorderRadius.circular(14),

                            child: Image.file(
                              selectedImage!,
                              width: 95,
                              height: 95,
                              fit: BoxFit.cover,
                            ),
                          ),

                          Positioned(
                            top: 5,
                            right: 5,

                            child: GestureDetector(
                              onTap: () {
                                setState(() {
                                  selectedImage = null;
                                });
                              },

                              child: Container(
                                width: 26,
                                height: 26,

                                decoration: BoxDecoration(
                                  color: Colors.black
                                      .withOpacity(0.65),
                                  shape: BoxShape.circle,
                                ),

                                child: const Icon(
                                  Icons.close,
                                  color: Colors.white,
                                  size: 17,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                  // MAIN INPUT ROW
                  Row(
                    crossAxisAlignment:
                        CrossAxisAlignment.end,

                    children: [

                      // ATTACHMENT
                      IconButton(
                        visualDensity:
                            VisualDensity.compact,

                        padding:
                            const EdgeInsets.all(7),

                        constraints:
                            const BoxConstraints(
                          minWidth: 40,
                          minHeight: 40,
                        ),

                        icon: Icon(
                          Icons.add_circle_outline,
                          size: 25,
                          color: isDarkMode
                              ? Colors.white70
                              : Colors.black87,
                        ),

                        onPressed:
                            isCurrentChatPaused
                                ? null
                                : showAttachmentMenu,
                      ),

                      // TEXT FIELD
                      Expanded(
                        child: ConstrainedBox(
                          constraints:
                              const BoxConstraints(
                            maxHeight: 140,
                          ),

                          child: TextField(
                            controller: controller,

                            enabled:
                                !isCurrentChatPaused,

                            minLines: 1,
                            maxLines: 5,

                            keyboardType:
                                TextInputType.multiline,

                            textInputAction:
                                TextInputAction.newline,

                            style: TextStyle(
                              color: isDarkMode
                                  ? Colors.white
                                  : Colors.black87,
                              fontSize: 16,
                            ),

                            onSubmitted: (value) {
                              if (isCurrentChatPaused) {
                                return;
                              }

                              if (selectedImage != null) {
                                uploadImage();
                                return;
                              }

                              if (selectedPdf != null) {
                                uploadPdf();
                                return;
                              }

                              if (value.trim().isNotEmpty) {
                                sendMessage();
                              }
                            },

                            decoration: InputDecoration(
                              hintText:
                                  "Ask anything...",

                              hintStyle: TextStyle(
                                color: isDarkMode
                                    ? Colors.white38
                                    : Colors.black38,
                                fontSize: 16,
                              ),

                              border:
                                  InputBorder.none,

                              enabledBorder:
                                  InputBorder.none,

                              focusedBorder:
                                  InputBorder.none,

                              disabledBorder:
                                  InputBorder.none,

                              contentPadding:
                                  const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 10,
                              ),
                            ),
                          ),
                        ),
                      ),

                      // MICROPHONE
                      IconButton(
                        visualDensity:
                            VisualDensity.compact,

                        padding:
                            const EdgeInsets.all(7),

                        constraints:
                            const BoxConstraints(
                          minWidth: 40,
                          minHeight: 40,
                        ),

                        icon: Icon(
                          isListening
                              ? Icons.mic
                              : Icons.mic_none,

                          size: 24,

                          color: isListening
                              ? const Color(0xff06B6D4)
                              : isDarkMode
                                  ? Colors.white70
                                  : Colors.black87,
                        ),

                        onPressed:
                            isCurrentChatPaused
                                ? null
                                : () {
                                    if (isListening) {
                                      stopListening();
                                    } else {
                                      startListening();
                                    }
                                  },
                      ),

                      // SEND
                      // SEND
Container(
  width: 40,
  height: 40,

  decoration: BoxDecoration(
    color: isCurrentChatPaused
        ? Colors.grey
        : const Color(0xff2563EB),
    shape: BoxShape.circle,
  ),

  child: IconButton(
    padding: EdgeInsets.zero,

    icon: const Icon(
      Icons.arrow_upward_rounded,
      color: Colors.white,
      size: 22,
    ),

    onPressed:
        isCurrentChatPaused
            ? null
            : () {
                if (selectedImage != null) {
                  uploadImage();
                } else if (selectedPdf != null) {
                  uploadPdf();
                } else {
                  sendMessage();
                }
              },
  ),
),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    ),
  );
}
}

class ChatSearchDelegate extends SearchDelegate<Map<String, dynamic>> {
  final List<Map<String, dynamic>> chats;

  ChatSearchDelegate(this.chats);

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
        close(context, <String, dynamic>{});
      },
    );
  }

  @override
  Widget buildResults(BuildContext context) {
    final results = chats.where((chat) {
      return (chat["title"] ?? "New Chat")
          .toString()
          .toLowerCase()
          .contains(query.toLowerCase());
    }).toList();

    return ListView.builder(
      itemCount: results.length,
      itemBuilder: (context, index) {
        return ListTile(
          leading: const Icon(Icons.chat_outlined),
          title: Text(
            results[index]["title"] ?? "New Chat",
            overflow: TextOverflow.ellipsis,
          ),
          onTap: () {
            final selectedChat = results[index];
            close(context, selectedChat);
          },
        );
      },
    );
  }

  @override
  Widget buildSuggestions(BuildContext context) {
    return buildResults(context);
  }
}














// =====================================================
// VEDAAI LIVE WORLD CLOCK WIDGET
// =====================================================

class VedaLiveClock extends StatefulWidget {
  final String city;
  final String timeZone;

  const VedaLiveClock({
    super.key,
    required this.city,
    required this.timeZone,
  });

  @override
  State<VedaLiveClock> createState() => _VedaLiveClockState();
}

class _VedaLiveClockState extends State<VedaLiveClock> {
  bool get _isDarkMode => Theme.of(context).brightness == Brightness.dark;
  bool get __isDarkMode => Theme.of(context).brightness == Brightness.dark;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(
      const Duration(seconds: 1),
      (_) {
        if (mounted) {
          setState(() {});
        }
      },
    );
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final location = tz.getLocation(widget.timeZone);
    final now = tz.TZDateTime.now(location);

    final timeText = DateFormat('hh:mm:ss a').format(now);
    final dateText = DateFormat('EEEE, d MMMM yyyy').format(now);
    final offset = now.timeZoneOffset;
    final sign = offset.isNegative ? '-' : '+';
    final hours = offset.inHours.abs().toString().padLeft(2, '0');
    final minutes = (offset.inMinutes.abs() % 60).toString().padLeft(2, '0');

    return Container(
      margin: const EdgeInsets.only(top: 12, bottom: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _isDarkMode
            ? const Color(0xff172554)
            : const Color(0xffEFF6FF),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: const Color(0xff38BDF8).withOpacity(0.45),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.public,
                color: Color(0xff38BDF8),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  widget.city,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: _isDarkMode ? Colors.white : Colors.black87,
                  ),
                ),
              ),
              const Icon(
                Icons.circle,
                size: 9,
                color: Colors.green,
              ),
              const SizedBox(width: 5),
              const Text(
                'LIVE',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: Colors.green,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            timeText,
            style: TextStyle(
              fontSize: 32,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.2,
              color: _isDarkMode ? Colors.white : const Color(0xff1D4ED8),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            dateText,
            style: TextStyle(
              fontSize: 13,
              color: _isDarkMode ? Colors.white70 : Colors.black54,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'UTC$sign$hours:$minutes  â€¢  ${widget.timeZone}',
            style: TextStyle(
              fontSize: 12,
              color: _isDarkMode ? Colors.white60 : Colors.black54,
            ),
          ),
        ],
      ),
    );
  }
}








