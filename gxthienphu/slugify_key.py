import re
def slugify_key(text):
    """
    Chuyển chuỗi có dấu thành không dấu, lowercase, thay thế khoảng trắng bằng dấu gạch dưới,
    và xử lý ký tự đặc biệt.
    """
    # 1. Chuyển đổi các ký tự có dấu thành không dấu
    text = re.sub(r'[áàảãạăắằẳẵặâấầẩẫậ]', 'a', text)
    text = re.sub(r'[éèẻẽẹêếềểễệ]', 'e', text)
    text = re.sub(r'[íìỉĩị]', 'i', text)
    text = re.sub(r'[óòỏõọôốồổỗộơớờởỡợ]', 'o', text)
    text = re.sub(r'[úùủũụưứừửữự]', 'u', text)
    text = re.sub(r'[ýỳỷỹỵ]', 'y', text)
    text = re.sub(r'[đ]', 'd', text)

    # 2. Xóa các ký tự đặc biệt khác và giữ lại chữ cái/số/khoảng trắng
    text = re.sub(r'[^a-z0-9\s]', '', text.lower())

    # 3. Thay thế khoảng trắng và gạch ngang bằng dấu gạch dưới
    text = re.sub(r'[\s-]+', '_', text)

    # 4. Xử lý trường hợp đặc biệt cho '#' (STT)
    if text == '':
        return 'stt'