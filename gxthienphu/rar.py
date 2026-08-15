import patoolib

# Đảm bảo thư mục CQ.BI#04 đã được đổi tên thành CQ_BI_04 trong Finder
thu_muc_can_nen = "CQ_BI_04"
file_rar_dau_ra = "CQ.BI#04.rar"

# Phải truyền tham số thứ hai là danh sách [thu_muc_can_nen]
patoolib.create_archive(file_rar_dau_ra, [thu_muc_can_nen])