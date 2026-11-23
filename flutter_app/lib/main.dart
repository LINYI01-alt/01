import 'package:flutter/material.dart';

void main() {
  runApp(const AiCompanionApp());
}

class AiCompanionApp extends StatelessWidget {
  const AiCompanionApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'AI 智能助手',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF3157D5),
          brightness: Brightness.light,
        ),
        scaffoldBackgroundColor: const Color(0xFFF6F7FB),
      ),
      home: const ChatPage(),
    );
  }
}

class ChatMessage {
  const ChatMessage({required this.text, required this.isUser});
  final String text;
  final bool isUser;
}

class ChatPage extends StatefulWidget {
  const ChatPage({super.key});

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  final List<ChatMessage> _messages = [
    const ChatMessage(
      text: '你好！我是你的 AI 智能助手。你可以向我提问，之后我们还会加入文件分析和智能任务功能。',
      isUser: false,
    ),
  ];

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _sendMessage() {
    final text = _controller.text.trim();
    if (text.isEmpty) return;

    setState(() {
      _messages.add(ChatMessage(text: text, isUser: true));
      _messages.add(const ChatMessage(
        text: '目前是界面演示版本，尚未连接 GPT 服务。下一步会通过安全的后端接口接入 AI，不会把 API 密钥放在手机 App 里。',
        isUser: false,
      ));
    });
    _controller.clear();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        title: const Row(
          children: [
            CircleAvatar(
              radius: 17,
              backgroundColor: Color(0xFFE8EDFF),
              child: Icon(Icons.auto_awesome, color: Color(0xFF3157D5), size: 19),
            ),
            SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('AI 智能助手', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                Text('跨平台开发版', style: TextStyle(fontSize: 11, color: Colors.black54)),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: '新建对话',
            onPressed: () => setState(() {
              _messages
                ..clear()
                ..add(const ChatMessage(
                  text: '你好！我是你的 AI 智能助手。今天有什么可以帮你？',
                  isUser: false,
                ));
            }),
            icon: const Icon(Icons.add_comment_outlined),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              controller: _scrollController,
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
              children: [
                if (_messages.length == 1) ...[
                  const Text(
                    '今天想做什么？',
                    style: TextStyle(fontSize: 25, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    '从一个问题开始，AI 助手会陪你一步步完成。',
                    style: TextStyle(color: Colors.black54),
                  ),
                  const SizedBox(height: 18),
                  const Wrap(
                    spacing: 9,
                    runSpacing: 9,
                    children: [
                      _SuggestionChip(icon: Icons.edit_note, label: '帮我写一段文字'),
                      _SuggestionChip(icon: Icons.lightbulb_outline, label: '帮我想一个计划'),
                      _SuggestionChip(icon: Icons.summarize_outlined, label: '总结一份资料'),
                      _SuggestionChip(icon: Icons.task_alt, label: '整理待办事项'),
                    ],
                  ),
                  const SizedBox(height: 22),
                ],
                for (final message in _messages) _MessageBubble(message: message),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Container(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(top: BorderSide(color: Color(0xFFE9EAF0))),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  IconButton(
                    tooltip: '添加文件（后续开放）',
                    onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('文件上传功能将在下一阶段加入。')),
                    ),
                    icon: const Icon(Icons.attach_file),
                  ),
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      minLines: 1,
                      maxLines: 5,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _sendMessage(),
                      decoration: InputDecoration(
                        hintText: '输入你想问的问题…',
                        filled: true,
                        fillColor: const Color(0xFFF3F4F8),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(22),
                          borderSide: BorderSide.none,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    tooltip: '发送',
                    onPressed: _sendMessage,
                    icon: const Icon(Icons.arrow_upward),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message});
  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final isUser = message.isUser;
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 520),
        margin: const EdgeInsets.only(bottom: 14),
        padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 12),
        decoration: BoxDecoration(
          color: isUser ? const Color(0xFF3157D5) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          boxShadow: isUser
              ? null
              : const [BoxShadow(color: Color(0x09000000), blurRadius: 8, offset: Offset(0, 2))],
        ),
        child: Text(
          message.text,
          style: TextStyle(
            height: 1.45,
            color: isUser ? Colors.white : const Color(0xFF202333),
          ),
        ),
      ),
    );
  }
}

class _SuggestionChip extends StatelessWidget {
  const _SuggestionChip({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Chip(
      avatar: Icon(icon, size: 17, color: const Color(0xFF3157D5)),
      label: Text(label),
      backgroundColor: Colors.white,
      side: const BorderSide(color: Color(0xFFE5E8F1)),
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 7),
    );
  }
}
