#!/bin/bash

# --- CẤU HÌNH ---
# 1. URL của API FastAPI local của bạn
API_ENDPOINT="http://localhost:8000/api/scrape/diemdanh/data"

# 2. Payload: Đường dẫn navigation bạn muốn cào (Thay chuỗi bên dưới bằng link thật)
TARGET_URL="https://ccamspro.thongtinxuanloc.com/admin/diem-danh?nam_hoc=2024&lop=..." 

# 3. Định nghĩa nơi lưu file
DATE_TAG=$(date +"%Y%m%d_%H%M%S")
FILENAME="diemdanh_${DATE_TAG}.json"
LOCAL_DIR="/home/user/pipeline/stage"
HDFS_DIR="/user/hadoop/diemdanh/raw"
SPARK_APP="/home/user/pipeline/process_diemdanh.py"

# Tạo thư mục local nếu chưa có
mkdir -p $LOCAL_DIR

echo "=== [1] Bắt đầu gọi API Scraper lúc $(date) ==="

# Gọi API bằng CURL và lưu kết quả vào file json
# -s: Silent (không hiện thanh loading)
# -X POST: Phương thức POST
# -d: Dữ liệu body gửi đi
curl -s -X POST \
     -H "Content-Type: application/json" \
     -d "{\"url_navigation\": \"$TARGET_URL\"}" \
     $API_ENDPOINT > "$LOCAL_DIR/$FILENAME"

# Kiểm tra xem file có dữ liệu không (API có trả về gì không)
if [ -s "$LOCAL_DIR/$FILENAME" ]; then
    echo "API trả về dữ liệu thành công. File: $LOCAL_DIR/$FILENAME"

    echo "=== [2] Upload lên HDFS ==="
    hdfs dfs -put "$LOCAL_DIR/$FILENAME" "$HDFS_DIR/"
    
    if [ $? -eq 0 ]; then
        echo "Upload HDFS thành công."
        
        echo "=== [3] Submit Spark Job ==="
        # Gọi Spark để xử lý file vừa upload
        spark-submit \
            --master yarn \
            --deploy-mode client \
            $SPARK_APP "hdfs://namenode:9000$HDFS_DIR/$FILENAME"
            
        # (Optional) Xóa file local sau khi xong
        # rm "$LOCAL_DIR/$FILENAME"
    else
        echo "Lỗi: Không upload được lên HDFS."
    fi
else
    echo "Lỗi: API không trả về dữ liệu hoặc Server chưa bật."
fi