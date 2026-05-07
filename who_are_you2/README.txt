# お前は誰だ？ 公開用 v12（CSS/JS整理版）

## 起動
`title.html` を開いてください。

## 構成
- `title.html`：タイトル画面
- `12.html`：検索欄・記事画面
- `special.html`：TRUE ROUTE MOVIE / シーン再生
- `css/`：画面別CSSと共通メニューCSS
- `js/`：画面別JS、共通メニューJS、BGM、ゲームデータ
- `logo.png`：通常タイトル背景
- `png/`：画像フォルダ（ユーザー側で配置）
- `audio/`：MP3推奨BGMフォルダ（ユーザー側で配置）
- `wav/`：旧形式BGMフォルダ（wav / m4a を使う場合）

## BGM配置
ZIPには音声ファイルを入れていません。

推奨は MP3 です。以下のように `audio/` フォルダへ配置してください。

```text
audio/お前は誰だタイトル.mp3
audio/お前は誰だ検索.mp3
audio/シーン１.mp3
audio/バトル1.mp3
audio/感動1.mp3
audio/二度目の桜 シーン.mp3
audio/深海.mp3  ※使う場合のみ
```

旧形式も使えます。既存の `wav/` フォルダに wav / m4a を置いた場合も再生候補として探します。

```text
wav/お前は誰だタイトル.wav
wav/お前は誰だ検索.wav
wav/シーン１.wav
wav/バトル1.wav
wav/感動1.wav
wav/二度目の桜 シーン.m4a
wav/深海.wav  ※使う場合のみ
```

再生優先順位は、おおむね `audio/*.mp3` → `wav/*.mp3` → `wav/*.wav` → `wav/*.m4a` です。

## 削除したもの
以下はゲーム実行に不要な制作資料・旧CSSのため、公開用ZIPから外しています。

- `style.css`（旧CSS）
- `special.css`（旧CSS）
- `voice_script.txt`
- `omaewa_current_flow_script_v40.txt`
- `omaewa_story_textdata.txt`
- `omaewa_story_1_BGM_timing.xlsx`

## 整理内容
- HTML内CSSを `css/title.css`, `css/main.css`, `css/special.css` に分離
- Tキー共通メニューを `css/menu.css` と `js/menu.js` に統合
- タイトル画面JSを `js/title.js` に分離
- special画面JSを `js/special.js` に分離
- 検索画面JSを `js/main.js` に配置


v13 update:
- クリア後リザルトに「変化したこと」と「秘密にしておくこと」を表示します。
- 裏達成度100%の場合は SECRET COMPLETE と「裏クリアおめでとう」を表示します。
- クリア後の title.html に MUSIC PLAYER を表示します。
- MUSIC PLAYER は ./wav/ の音源を参照します。ZIPには音源を入れていません。


[v14]
- エンドロールはクリックでスキップ可能。
- 最終スコア画面は自動遷移せず、クリックで戻る。
- 検索結果メッセージを復活。
- 検索履歴を検索欄直下の候補UIに移動。


【タイトル画像の配置】
通常タイトル背景は、title.html と同じ階層の logo.png を使用します。
クリア後背景は、png/rogo.png を優先し、なければ rogo.png を使用します。
CSSフォルダ内には画像を置かないでください。

正しい例:
who_are_you2/title.html
who_are_you2/logo.png
who_are_you2/png/rogo.png

誤りの例:
who_are_you2/css/logo.png
who_are_you2/css/png/rogo.png

--- v16 追記：スマホ縦画面対応 ---
この版では、画面幅が細いスマホ縦画面の場合だけ専用レイアウトに切り替わります。
PC・タブレット横・スマホ横では従来の横長レイアウトを維持します。

スマホ縦画面では、検索画面は以下の順番で表示されます。
1. 検索欄
2. 検索履歴候補
3. 達成率・裏達成度
4. AD
5. 記事・検索結果

--- マナーモードについて ---
ブラウザのHTML/JavaScriptから、端末がマナーモードかどうかを正確に検出する標準APIはありません。
そのため、マナーモードに自動連動してBGMを必ず停止する処理は実装していません。
音を消したい場合は、TキーのMENU内にある音楽設定からミュート、またはBGM OFFを使用してください。

--- v17 mobile title background ---
スマホ縦画面の title.html では、専用の縦長背景を使用します。

通常スマホ縦タイトル背景:
  mobile-logo.png

クリア後スマホ縦タイトル背景:
  mobile-rogo.png

PC・横長画面では従来通り logo.png / png/rogo.png を使用します。


v18 変更点:
- スマホ縦画面の special.html では、背景/シーン画像を cover で切り抜かず、横幅100%基準で表示します。縦に余った領域を字幕用として使います。
- special.html の字幕ボックスは、テキストがある間は固定表示のまま本文だけ差し替えます。行ごとにフェードアウトして再表示する挙動は廃止しました。
- 12.html 内の TRUE ROUTE MOVIE 画像表示も、スマホ縦では横幅基準にしています。

【v19 追記】
- 本編画面（12.html）とTRUE ROUTE MOVIE（special.html）では、画面右端に常時表示される三本線（☰）ボタンからメニューを開けます。
- PCではTキーでも同じメニューを開けます。スマホでは☰ボタンを使ってください。
- メニュー内で「検索欄へ戻る」「タイトルへ戻る」「音量設定」を操作できます。

--- v20 追記：メニューとスマホ表示 ---
- ☰メニューは右上端に固定表示します。
- スマホではTキーを使えないため、☰メニューから操作します。
- special.html の中央停止ボタン/進行バーUIは非表示にし、操作は☰メニューへ集約しました。
- special.html の「このシーンをスキップ」は☰メニュー内に表示されます。
- スマホ縦の画像表示は横幅基準のまま、画像位置を中央にしました。


--- v21 追記：MP3対応 ---
- BGMは mp3 / wav / m4a に対応しました。
- 推奨配置は `audio/曲名.mp3` です。
- 既存のBGM指定が `wav/曲名.wav` のままでも、同じ曲名の `audio/曲名.mp3` があれば優先して再生します。
- ZIPには音源を入れていません。
