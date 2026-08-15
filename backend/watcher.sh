#!/bin/bash

# --- CẤU HÌNH CHO MACBOOK ---

# Lấy user hiện tại tự động
USER_NAME=$(whoami)

# Đường dẫn trên ổ cứng Mac (Local Filesystem)
STAGING_DIR="/Users/$USER_NAME/pipeline_data/staging"
PROCESSED_DIR="/Users/$USER_NAME/pipeline_data/archive"
LOG_DIR="/Users/$USER_NAME/pipeline_data/logs"

# Đường dẫn trên Hadoop HDFS (Giữ nguyên vì đây là đường dẫn ảo trong Hadoop)
HDFS_DIR="/user/hadoop/diemdanh/raw"

# Đường dẫn tới file code Spark
SPARK_APP="/Users/$USER_NAME/Desktop/backend/process_diemdanh.py" 
# (Lưu ý: Sửa lại đường dẫn nơi bạn thực sự để file process_diemdanh.py)

# Tạo thư mục nếu chưa có
mkdir -p $PROCESSED_DIR
mkdir -p $STAGING_DIR

# Kiểm tra xem có file json nào trong thư mục staging không
# shopt -s nullglob để tránh lỗi nếu không có file
shopt -s nullglob
files=($STAGING_DIR/*.json)

if [ ${#files[@]} -eq 0 ]; then
    # Không có file thì thoát im lặng
    exit 0
fi

echo "=== Tìm thấy ${#files[@]} file mới lúc $(date) ==="

for file in "${files[@]}"; do
    filename=$(basename "$file")
    
    echo "Processing: $filename"
    
    # 1. Upload lên HDFS
    hdfs dfs -put "$file" "$HDFS_DIR/"
    
    if [ $? -eq 0 ]; then
        echo " -> Uploaded to HDFS."
        
        # 2. Submit Spark Job
        # Lưu ý: Spark job cần sửa một chút để đọc cấu trúc JSON mới (có metadata)
        spark-submit \
            --master yarn \
            --deploy-mode client \
            $SPARK_APP "hdfs://namenode:9000$HDFS_DIR/$filename"
            
        if [ $? -eq 0 ]; then
            echo " -> Spark Job Success."
            # 3. Di chuyển file local vào thư mục lưu trữ (để không xử lý lại)
            mv "$file" "$PROCESSED_DIR/"
        else
            echo " -> Spark Job Failed."
        fi
    else
        echo " -> Upload Failed."
    fi
done