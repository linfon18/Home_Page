#!/bin/bash

# 个人主页部署脚本 - 兼容 EdgeOne Pages pyenv 环境

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 获取 Python 命令（优先 python3）
get_python_cmd() {
    if command -v python3 &> /dev/null; then
        echo "python3"
    elif command -v python &> /dev/null; then
        echo "python"
    else
        echo ""
    fi
}

# 获取 pip 命令（使用 python -m pip 方式，避开 pyenv 问题）
get_pip_cmd() {
    PYTHON_CMD=$(get_python_cmd)
    if [ -n "$PYTHON_CMD" ]; then
        # 测试 python -m pip 是否可用
        if $PYTHON_CMD -m pip --version &> /dev/null; then
            echo "$PYTHON_CMD -m pip"
            return
        fi
    fi
    
    # 备用方案
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
    
    if [ -z "$PYTHON_CMD" ]; then
        echo -e "${RED}错误：未找到 Python${NC}"
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
        echo -e "${RED}❌ 依赖安装失败${NC}"
        exit 1
    fi
}

# 构建静态文件
build_static() {
    echo -e "${GREEN}🏗️ 正在构建静态文件...${NC}"
    
    PYTHON_CMD=$(get_python_cmd)
    if [ -z "$PYTHON_CMD" ]; then
        echo -e "${RED}错误：未找到 Python${NC}"
        exit 1
    fi
    
    # 确保依赖已安装
    install_deps
    
    # 运行构建
    $PYTHON_CMD build_static.py
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 构建完成！${NC}"
    else
        echo -e "${RED}❌ 构建失败${NC}"
        exit 1
    fi
}

# 帮助信息
show_help() {
    echo "用法: bash deploy.sh [install|build]"
}

# 主函数
main() {
    case "$1" in
        install)
            install_deps
            ;;
        build)
            build_static
            ;;
        *)
            show_help
            exit 1
            ;;
    esac
}

main "$@"
