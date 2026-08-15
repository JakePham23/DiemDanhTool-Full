import sys
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, explode

def main(input_path):
    spark = SparkSession.builder.appName("DiemDanhProcessor").getOrCreate()

    # Đọc file JSON
    raw_df = spark.read.option("multiLine", "true").json(input_path)
    
    # Cấu trúc JSON giờ là: { "metadata": {...}, "data": [ ... ] }
    if "data" in raw_df.columns:
        # Explode mảng "data"
        students_df = raw_df.select(explode(col("data")).alias("student"))
        
        # Select các cột bên trong object student
        # LƯU Ý: Kiểm tra kỹ tên cột trong file JSON thực tế (Selenium trả về key tiếng Việt hay Anh?)
        # Ví dụ nếu Selenium trả về: { "ma_hoc_vien": "...", "ten": "..." }
        final_df = students_df.select(
            col("student.ma_hoc_vien").alias("id"),
            col("student.ho_va_ten").alias("name"), # Sửa theo key thật trong getListDiemDanhByInfo
            col("student.loai_diem_danh").alias("attendance_type") 
        )
        
        final_df.show(5)
        
        # Ghi xuống HDFS (Parquet)
        final_df.write.mode("append").parquet("/user/hadoop/diemdanh/processed/")
        
    spark.stop()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: process_diemdanh.py <hdfs_input_file>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    main(input_file)