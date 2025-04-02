import os
import re

def read_markdown_file(file_path):
    """读取 Markdown 文件内容"""
    with open(file_path, 'r', encoding='utf-8') as file:
        return file.read()

def parse_markdown_cards(md_content):
    """
    解析 Markdown 文件：
      - 第一行的 H1 作为整体标题
      - 每个 H2 及其后面的描述作为一个卡片，
        H2 格式要求为 markdown 链接格式，如 [标题](链接)
    """
    lines = md_content.splitlines()
    overall_title = ""
    cards = []
    i = 0

    # 查找第一个以 "# " 开头的非空行作为整体标题
    while i < len(lines):
        line = lines[i].strip()
        if line.startswith("# "):
            overall_title = line.lstrip("#").strip()
            i += 1
            break
        i += 1

    # 处理每个 H2 块
    while i < len(lines):
        line = lines[i].strip()
        if line.startswith("## "):
            # 解析 H2 这一行，格式类似：[标题](链接)
            header_line = line.lstrip("##").strip()
            m = re.match(r'\[(.*?)\]\((.*?)\)', header_line)
            if m:
                card_title = m.group(1)
                card_link = m.group(2)
            else:
                card_title = header_line
                card_link = "#"
            # 收集 H2 后面的描述行，直到遇到空行或下一个 H2
            i += 1
            description_lines = []
            while i < len(lines):
                current = lines[i].strip()
                if current == "":
                    i += 1
                    # 遇到空行，则结束当前卡片描述的收集
                    break
                # 如果遇到下一个 H2，结束描述
                if current.startswith("## "):
                    break
                description_lines.append(current)
                i += 1
            card_description = " ".join(description_lines)
            cards.append({
                "title": card_title,
                "link": card_link,
                "description": card_description
            })
        else:
            i += 1

    return overall_title, cards

def generate_cards_html(cards):
    """
    根据卡片列表生成 HTML 代码，每个卡片格式参考示例：
    <a href="{link}" class="card rounded-xl p-6 shadow-lg hover:shadow-xl">
        <div class="flex flex-col items-center">
            <h2 class="text-2xl font-bold text-gray-800 mb-2">{title}</h2>
            <p class="text-gray-600 text-center">{description}</p>
        </div>
    </a>
    """
    card_template = '''
    <a href="{link}" class="card rounded-xl p-6 shadow-lg hover:shadow-xl">
        <div class="flex flex-col items-center">
            <h2 class="text-2xl font-bold text-gray-800 mb-2">{title}</h2>
            <p class="text-gray-600 text-center">{description}</p>
        </div>
    </a>
    '''
    cards_html = "\n".join([card_template.format(link=card["link"],
                                                  title=card["title"],
                                                  description=card["description"])
                              for card in cards])
    return cards_html

def get_html_template(page_title, overall_title, cards_html,sub_title):
    """生成完整 HTML 页面，样式和结构参考提供的模板"""
    return f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{page_title}</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css" rel="stylesheet">
    <style>
        .gradient-bg {{
            background: linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%);
        }}
        .card {{
            backdrop-filter: blur(10px);
            background-color: rgba(255, 255, 255, 0.8);
            transition: transform 0.3s ease;
        }}
        .card:hover {{
            transform: translateY(-5px);
        }}
        @keyframes float {{
            0% {{ transform: translateY(0px); }}
            50% {{ transform: translateY(-20px); }}
            100% {{ transform: translateY(0px); }}
        }}
        .animate-float {{
            animation: float 6s ease-in-out infinite;
        }}
    </style>
</head>
<body class="gradient-bg min-h-screen">
    <div class="container mx-auto px-4 py-8">
        <!-- 标题部分 -->
        <header class="text-center mb-12">
            <h1 class="text-4xl md:text-6xl font-bold text-white mb-4 animate-float">{overall_title}</h1>
            <p class="text-xl text-white opacity-90">{sub_title}</p>
        </header>

        <!-- 主要内容卡片 -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {cards_html}
        </div>
    </div>
</body>
</html>
'''

def save_html_file(output_path, content):
    """保存 HTML 文件"""
    with open(output_path, 'w', encoding='utf-8') as file:
        file.write(content)

def main():
    input_markdown = "./Lecture_notes/TML/index.md"  # Markdown 文件路径
    output_html = "./Lecture_notes/TML/index.html"  # 输出的 HTML 文件路径
    sub_title="待补充"


    if not os.path.exists(input_markdown):
        print(f"文件 {input_markdown} 不存在")
        return

    md_content = read_markdown_file(input_markdown)
    overall_title, cards = parse_markdown_cards(md_content)
    cards_html = generate_cards_html(cards)
    # 使用整体标题作为页面标题
    full_html = get_html_template(overall_title, overall_title, cards_html,sub_title)
    save_html_file(output_html, full_html)
    print(f"转换完成！HTML 文件已生成：{output_html}")

if __name__ == "__main__":
    main()
