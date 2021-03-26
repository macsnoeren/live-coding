# Install nodejs - in this case nodejs 10.x

apt-get install curl # Make sure curl is installed

curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -


# Install firefail for safe execution, console and compilation of code

apt-get install firejail

# Install the Java environment (Oracle preffered)
# See, https://www.digitalocean.com/community/tutorials/how-to-install-java-with-apt-get-on-debian-8

apt-get install software-properties-common
add-apt-repository "deb http://ppa.launchpad.net/webupd8team/java/ubuntu xenial main"
apt-get update
apt-get install oracle-java8-installer

# install npm forever
npm install forever -g

# Python packages
apt-get install python-crypto

# Java
There is an alternative java in etc. That breaks the firejail on etc, therefore the
symlinks to java and javac need to be changed to the correct ones.
When home is used as compiler (in this case) the home directory needs to be blacklisted
The compiler directory is whitelisted and that creates a good sandbox for this one.
mkfs.ext3 codingskills.tmpfs
 mount -t ext3 -o loop codingskills.ext3 compiler
