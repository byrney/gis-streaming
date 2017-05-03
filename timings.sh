function perf {
   curl -o /dev/null -s -w "%{time_connect} + %{time_starttransfer} = %{time_total}\n" "$1"
}

echo "no streaming"
perf 'http://localhost:3000/sync'
echo "strip out geom column"
perf 'http://localhost:3000/streamstrip'
echo "raw geom column (wkb hex)"
perf 'http://localhost:3000/streamraw'
echo "geo json"
perf 'http://localhost:3000/streamjson'
