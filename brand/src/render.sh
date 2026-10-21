# usage: render.sh in.svg out.png W H [bg]
R=/workspace/design/podsta-brand; t=$(mktemp --suffix=.html -p $R/src)
bg=${5:-transparent}
echo "<html><body style='margin:0;background:$bg'><img src='file://$R/$1' style='width:${3}px;height:${4}px;display:block'></body></html>" > $t
google-chrome --headless=new --no-sandbox --hide-scrollbars --force-device-scale-factor=1 --default-background-color=00000000 --window-size=$3,$4 --screenshot=$R/$2 file://$t 2>/dev/null; rm $t
