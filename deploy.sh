#!/bin/bash

# 个人主页部署脚本 - 兼容 EdgeOne Pages pyenv 环境

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 强制使用 python3 -m pip，完全避开 pyenv 的 pip3 命令
PYTHON_CMD="python3"
PIP_CMD="$PYTHON_CMD -m pip"

# 安装依赖
install_deps() {
    echo -e "${GREEN}正在安装项目依赖...${NC}"
    
    # 验证 Python 可用
    if ! command -v $PYTHON_CMD &> /dev/null; then
        echo -e "${RED}错误：未找到 python3${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}Python 版本: $($PYTHON_CMD --version)${NC}"
    echo -e "${BLUE}Pip 版本: $($PIP_CMD --version)${NC}"
    
    # 升级 pip
    echo -e "${YELLOW}升级 pip...${NC}"
    $PIP_CMD install --upgrade pip setuptools wheel -q
    
    # 安装依赖
    echo -e "${YELLOW}安装 requirements.txt...${NC}"
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
    
    # 先安装依赖
    install_deps
    
    # 运行构建脚本
    echo -e "${YELLOW}执行 build_static.py...${NC}"
    $PYTHON_CMD build_static.py
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 构建完成！${NC}"
        # 显示输出目录内容
        if [ -d "./dist" ]; then
            echo -e "${BLUE}输出目录内容:${NC}"
            ls -la ./dist/
        fi
    else
        echo -e "${RED}❌ 构建失败${NC}"
        exit 1
    fi
}

# 帮助信息
show_help() {
    echo "用法: bash deploy.sh [install|build]"
    echo "  install - 安装依赖"
    echo "  build   - 构建静态文件"
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
