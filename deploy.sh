#!/bin/bash

# 个人主页部署脚本
# 兼容 EdgeOne Pages / GitHub Pages / Vercel / Netlify 等静态托管平台

# 颜色定义（兼容不同终端）
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # 无颜色

# 检测是否在 EdgeOne Pages 环境
IS_EDGEONE=false
if [ -n "$EDGEONE_PAGES" ] || [ -n "$CF_PAGES" ] || [ -n "$VERCEL" ]; then
    IS_EDGEONE=true
fi

# 获取 Python 命令（优先 python3）
get_python_cmd() {
    if command -v python3 &> /dev/null; then
        echo "python3"
    elif command -v python &> /dev/null; then
        # 检查是否是 Python 3
        PY_VERSION=$(python --version 2>&1 | grep -oP '\d+' | head -1)
        if [ "$PY_VERSION" = "3" ]; then
            echo "python"
        else
            echo ""
        fi
    else
        echo ""
    fi
}

# 获取 pip 命令
get_pip_cmd() {
    if command -v pip3 &> /dev/null; then
        echo "pip3"
    elif command -v pip &> /dev/null; then
        echo "pip"
    else
        echo ""
    fi
}

# 安装依赖
install_deps() {
    echo -e "${GREEN}正在安装项目依赖...${NC}"
    
    PYTHON_CMD=$(get_python_cmd)
    PIP_CMD=$(get_pip_cmd)
    
    # 检查 Python 3 是否可用
    if [ -z "$PYTHON_CMD" ]; then
        echo -e "${YELLOW}未找到 Python 3，尝试安装...${NC}"
        
        # 尝试安装 Python 3（不同 Linux 发行版）
        if command -v apt-get &> /dev/null; then
            apt-get update -qq && apt-get install -y -qq python3 python3-pip
        elif command -v yum &> /dev/null; then
            yum install -y python3 python3-pip
        elif command -v apk &> /dev/null; then
            apk add --no-cache python3 py3-pip
        elif command -v pacman &> /dev/null; then
            pacman -Sy python python-pip --noconfirm
        fi
        
        # 重新检测
        PYTHON_CMD=$(get_python_cmd)
        PIP_CMD=$(get_pip_cmd)
    fi
    
    if [ -z "$PYTHON_CMD" ] || [ -z "$PIP_CMD" ]; then
        echo -e "${RED}错误：无法找到或安装 Python 3 和 pip${NC}"
        echo -e "${YELLOW}当前环境：$(uname -a)${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}使用 Python: $PYTHON_CMD ($($PYTHON_CMD --version))${NC}"
    echo -e "${BLUE}使用 pip: $PIP_CMD${NC}"
    
    # 升级 pip
    $PIP_CMD install --upgrade pip setuptools wheel -q
    
    # 安装依赖
    $PIP_CMD install -r requirements.txt
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 依赖安装成功！${NC}"
    else
        echo -e "${RED}❌ 依赖安装失败，请检查 requirements.txt${NC}"
        exit 1
    fi
}

# 运行开发服务器
run_dev() {
    echo -e "${GREEN}正在启动开发服务器...${NC}"
    echo -e "${YELLOW}服务器将在 http://localhost:5000 上运行${NC}"
    echo -e "${YELLOW}按 Ctrl+C 停止服务器${NC}"
    
    PYTHON_CMD=$(get_python_cmd)
    if [ -z "$PYTHON_CMD" ]; then
        echo -e "${RED}错误：未找到 Python${NC}"
        exit 1
    fi
    
    $PYTHON_CMD app.py
}

# 构建静态文件
build_static() {
    echo -e "${GREEN}🏗️ 正在构建静态文件...${NC}"
    
    PYTHON_CMD=$(get_python_cmd)
    if [ -z "$PYTHON_CMD" ]; then
        echo -e "${RED}错误：未找到 Python 3${NC}"
        exit 1
    fi
    
    # 在 EdgeOne 环境中，确保依赖已安装
    if [ "$IS_EDGEONE" = true ]; then
        echo -e "${BLUE}检测到云构建环境，确保依赖已安装...${NC}"
        install_deps
    fi
    
    # 运行构建脚本
    $PYTHON_CMD build_static.py
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 静态文件构建完成！${NC}"
        
        # 检查输出目录
        if [ -d "./dist" ]; then
            echo -e "${BLUE}📁 输出目录: ./dist${NC}"
            ls -la ./dist/
        elif [ -f "./index.html" ]; then
            echo -e "${BLUE}📄 生成文件: ./index.html${NC}"
        fi
        
        if [ "$IS_EDGEONE" = false ]; then
            echo -e "${YELLOW}💡 提示：可以将 dist/ 目录或 index.html 部署到静态托管服务${NC}"
        fi
    else
        echo -e "${RED}❌ 静态文件构建失败${NC}"
        exit 1
    fi
}

# 部署指南
deploy_help() {
    echo -e "${YELLOW}🚀 部署指南${NC}"
    echo ""
    echo -e "${GREEN}1. EdgeOne Pages（当前平台）${NC}"
    echo "   - 已配置自动构建"
    echo "   - 每次推送代码会自动部署"
    echo ""
    echo -e "${GREEN}2. GitHub Pages${NC}"
    echo "   方法一：GitHub Actions 自动部署"
    echo "   - 配置文件: .github/workflows/build-deploy.yml"
    echo "   - 每天 UTC 0 点自动构建，或手动触发"
    echo ""
    echo "   方法二：手动部署"
    echo "   ./deploy.sh build"
    echo "   git add dist/ && git commit -m 'update' && git push"
    echo ""
    echo -e "${GREEN}3. Vercel / Netlify${NC}"
    echo "   - 连接 GitHub 仓库即可自动部署"
    echo "   - 构建命令: bash deploy.sh build"
    echo "   - 输出目录: dist"
    echo ""
    echo -e "${GREEN}4. PythonAnywhere / Heroku${NC}"
    echo "   - 使用动态服务器部署（非静态）"
    echo "   - 参考项目文档配置"
}

# 帮助信息
show_help() {
    echo -e "${YELLOW}用法: ./deploy.sh [命令]${NC}"
    echo ""
    echo "命令:"
    echo "  install     安装 Python 依赖"
    echo "  run         本地运行 Flask 开发服务器"
    echo "  build       构建静态文件（用于部署）"
    echo "  deploy      显示部署指南"
    echo "  help        显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  ./deploy.sh install   # 首次安装依赖"
    echo "  ./deploy.sh run       # 本地开发调试"
    echo "  ./deploy.sh build     # 构建生产版本"
    echo ""
    echo -e "${BLUE}当前环境: $(uname -s), Python: $(get_python_cmd)${NC}"
}

# 主函数
main() {
    # 无参数时显示帮助
    if [ $# -eq 0 ]; then
        show_help
        exit 0
    fi
    
    # 执行对应命令
    case "$1" in
        install)
            install_deps
            ;;
        run)
            run_dev
            ;;
        build)
            build_static
            ;;
        deploy)
            deploy_help
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            echo -e "${RED}❌ 未知命令: $1${NC}"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"
