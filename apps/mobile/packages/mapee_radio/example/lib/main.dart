import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mapee_radio/mapee_radio.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  String _status = 'Loading...';
  final _hostApi = RadioInfoHostApi();

  @override
  void initState() {
    super.initState();
    initRadioInfo();
  }

  Future<void> initRadioInfo() async {
    String status;
    try {
      final RadioInfo info = await _hostApi.getRadioInfo();
      status =
          'carrierName: ${info.carrierName ?? '(none)'}\n'
          'radioAccessTechnology: ${info.radioAccessTechnology ?? '(none)'}';
    } on PlatformException catch (e) {
      status = 'Failed to get radio info: ${e.message}';
    }

    if (!mounted) return;

    setState(() {
      _status = status;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        appBar: AppBar(title: const Text('mapee_radio example')),
        body: Center(child: Text(_status)),
      ),
    );
  }
}
