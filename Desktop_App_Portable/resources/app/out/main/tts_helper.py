import sys
import asyncio
import edge_tts

async def synthesize(text, voice):
    try:
        communicate = edge_tts.Communicate(text, voice)
        chunks = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                chunks.append(chunk["data"])
        data = b"".join(chunks)
        sys.stdout.buffer.write(data)
    except Exception as e:
        sys.stderr.write(f"TTS Error: {e}\n")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(0)
    text = sys.argv[1]
    voice = sys.argv[2] if len(sys.argv) > 2 else "en-GB-RyanNeural"
    asyncio.run(synthesize(text, voice))
