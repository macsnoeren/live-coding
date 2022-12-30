# Create a 100MB file system to store the java files
dd if=/dev/zero of=compiler.fs bs=1024 count=102400
/sbin/mkfs.ext4 compiler.fs
mkdir clientenvironments
mount -o loop compiler.fs clientenvironments
chmod 770 clientenvironments
