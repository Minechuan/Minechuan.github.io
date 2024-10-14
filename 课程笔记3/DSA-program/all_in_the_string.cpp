#include<iostream>
#include<string>
using namespace std;
bool func(string s,string t){
    int l_s=s.length();
    int l_t=t.length();
    int point_s=0;
    int point_t=0;
    int same_char=0;
    while(same_char<l_s && point_s<l_s && point_t<l_t){
        if(t[point_t]==s[point_s]){
            same_char++;
            point_s++;
            point_t++;
        }
        else{
            point_t++;
        }
    }
    //cout<<point_s<<"t="<<point_t<<endl;
    //cout<<same_char<<endl;
    if(same_char==l_s){
        return true;
    }
    else{
        return false;
    }
}
int main(){
    string S;
    string T;
    while(cin>>S){
        cin>>T;
        bool ans=func(S,T);
        if(ans){
            cout<<"Yes"<<endl;
        }
        else{
            cout<<"No"<<endl;
        }
    }
}