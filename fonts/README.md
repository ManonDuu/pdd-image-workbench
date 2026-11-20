# 可选的本地内置字体

工作台默认通过公共 CDN 加载内置字体（HarmonyOS Sans SC、Maple Mono NF CN），并回退到系统中文字体（如苹方、微软雅黑）。因此，即使本目录不包含字体文件，安装和日常使用也不受影响。

若你希望离线使用「内置字体」并随应用分发本地文件：

1. 将上游项目 `CookSleep/gpt_image_playground` 中未经修改的字体文件放到本目录。HarmonyOS Sans SC 的许可只允许分发未修改的副本，请不要裁切或转换。
2. 需要的文件：
   - `harmonyos-sans-sc.css` 与 `HarmonyOS_Sans_SC_Regular.ttf` / `HarmonyOS_Sans_SC_Medium.ttf` / `HarmonyOS_Sans_SC_Bold.ttf`
   - `maple-mono-nf-cn.css` 与 `MapleMono-NF-CN-Regular.woff2`
3. 启动或构建时设置环境变量 `VITE_BUILTIN_FONT_SOURCE=local`。

本发布源码为了把归档控制在较小体积，默认不附带上述字体二进制文件。
