// Howler.jsのオーディオオブジェクトを初期化
for (let i = 0; i <= 29; i++) {
    const sound = new Howl({
        src: [path + i + ".caf"], // CAFファイルへの正しいパスに置き換えてください
        volume: 0,
        preload: true,
    });
    pianoSounds.push(sound);
}
// Howler.jsを使用してオーディオを再生
function soundPlay(soundNum) {
    pianoSounds[soundNum].volume(1);
    pianoSounds[soundNum].seek(0); // オーディオ再生を開始位置にリセット
    pianoSounds[soundNum].play();
}

// Howler.jsを使用してオーディオを停止（フェードアウト）
function soundStop(soundNum) {
    // 500ミリ秒でフェードアウト（必要に応じて調整）
    pianoSounds[soundNum].fade(1, 0, 500);
}